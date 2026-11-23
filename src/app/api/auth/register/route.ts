import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  createNewUser,
  dbExec,
  dbOne,
  seedDefaultPointPresets,
  toSqlBool,
} from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  assertSafeText,
  assertSafeUsername,
  assertStrongPassword,
  slugifySchoolName,
} from '@/lib/sanitize';
import {
  SUBSCRIPTION_PLANS,
  isPaidPlanCode,
  isSubscriptionPlanCode,
  type SubscriptionPlanCode,
} from '@/lib/subscription-plans';
import { getPlanPriceIdr } from '@/lib/plans';
import { createServerSession } from '@/lib/session';
import { ValidationError, handleApiError, toSchoolDTO } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';

export async function POST(request: Request) {
  let createdSchoolId: string | null = null;
  try {
    assertSameOriginMutation(request);

    const ip = getClientIp(request);
    const limit = checkRateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak pendaftaran dari IP Anda. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Data pendaftaran tidak valid.');
    }

    const schoolName = assertSafeText(body.schoolName, 'Nama Sekolah', 120)
      .replace(/\s+/g, ' ')
      .trim();
    const city = assertSafeText(body.city || 'Indonesia', 'Kota/Kabupaten', 80);
    const gugusdepan = assertSafeText(body.gugusdepan || '', 'Nomor Gugusdepan', 80);
    const npsn = assertSafeText(body.npsn || '', 'NPSN', 30);
    const contactPhone = assertSafeText(body.contactPhone || '', 'Nomor WhatsApp/Telepon', 30);
    const fullName = assertSafeText(body.fullName, 'Nama Lengkap Admin', 120);
    const username = assertSafeUsername(body.username).toLowerCase();
    const password = assertStrongPassword(body.password, 'Password');

    if (schoolName.length < 3) {
      throw new ValidationError('Nama sekolah minimal 3 karakter.');
    }
    if (fullName.length < 2) {
      throw new ValidationError('Nama lengkap admin minimal 2 karakter.');
    }

    const rawPlan: SubscriptionPlanCode = isSubscriptionPlanCode(body.plan) ? body.plan : 'trial';
    const billingCycle =
      body.billingCycle === 'yearly' || rawPlan === 'pro' ? 'yearly' : 'monthly';
    const planDef = SUBSCRIPTION_PLANS[rawPlan];

    // Cek apakah nama sekolah sudah terdaftar (case-insensitive, abaikan yang sudah di-soft delete)
    const existingSchool = await dbOne<{ id: string; name: string }>(
      `SELECT id, name FROM schools WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1`,
      [schoolName]
    );

    if (existingSchool) {
      throw new ValidationError(
        `Sekolah "${existingSchool.name}" sudah terdaftar di sistem. Silakan login atau gunakan nama sekolah yang berbeda.`
      );
    }

    // Cek ketersediaan username lebih dulu
    const existingUser = await dbOne<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
      [username]
    );

    if (existingUser) {
      throw new ValidationError('Username sudah terdaftar. Silakan pilih username lain.');
    }

    // Buat slug sekolah yang unik
    const baseSlug = slugifySchoolName(schoolName);
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const slug = `${baseSlug}-${randomSuffix}`;

    const now = new Date();
    const nowIso = now.toISOString();
    const isTrial = rawPlan === 'trial';
    const expiresAt = isTrial
      ? new Date(now.getTime() + SUBSCRIPTION_PLANS.trial.durationDays * 24 * 60 * 60 * 1000)
      : now; // Paket berbayar berstatus pending hingga dibayar/redeem lisensi

    const initialPlanCredits = planDef.aiPlanCredits;
    const schoolId = crypto.randomUUID();
    const schoolRow = await dbOne<Record<string, unknown>>(
      `INSERT INTO schools (
         id, name, slug, npsn, city, gugusdepan, contact_name, contact_phone,
         subscription_plan, subscription_status, subscription_started_at, subscription_expires_at,
         max_students, max_users, ai_features_enabled, ai_plan_credits, ai_topup_credits, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       RETURNING *`,
      [
        schoolId,
        schoolName,
        slug,
        npsn || null,
        city || 'Indonesia',
        gugusdepan || `Gugusdepan ${schoolName}`,
        fullName,
        contactPhone || null,
        rawPlan,
        isTrial ? 'trial' : 'pending',
        nowIso,
        expiresAt.toISOString(),
        planDef.maxStudents,
        planDef.maxUsers,
        toSqlBool(planDef.aiFeaturesEnabled),
        initialPlanCredits,
        nowIso,
        nowIso,
      ]
    );

    if (!schoolRow) {
      throw new Error('Gagal mendaftarkan sekolah.');
    }
    createdSchoolId = String(schoolRow.id);

    await dbExec(
      `INSERT INTO ai_credit_logs (id, school_id, user_id, type, source, amount, feature, created_at)
       VALUES (?, ?, NULL, 'plan_reset', 'plan', ?, ?, ?)`,
      [crypto.randomUUID(), createdSchoolId, initialPlanCredits, `register:${rawPlan}`, nowIso]
    );

    // Buat akun Admin pertama terikat strict ke school_id baru ini
    let createdUser;
    try {
      createdUser = await createNewUser({
        username,
        fullName,
        password,
        role: 'admin',
        schoolId: createdSchoolId,
      });
    } catch (userErr: unknown) {
      await dbExec(`DELETE FROM schools WHERE id = ?`, [createdSchoolId]);
      createdSchoolId = null;
      const msg = userErr instanceof Error ? userErr.message : String(userErr || '');
      throw new ValidationError(
        msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint')
          ? 'Username sudah terdaftar.'
          : msg || 'Gagal membuat akun admin sekolah.'
      );
    }

    // Seed master poin default khusus milik sekolah baru ini
    await seedDefaultPointPresets(createdSchoolId);

    // Jika memilih paket berbayar, buat invoice pending awal otomatis
    let initialInvoice: Record<string, unknown> | null = null;
    if (isPaidPlanCode(rawPlan)) {
      const amountIdr = getPlanPriceIdr(rawPlan, billingCycle);
      const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

      initialInvoice = await dbOne<Record<string, unknown>>(
        `INSERT INTO subscription_invoices (
           id, invoice_number, school_id, requested_by, plan_code, billing_cycle,
           amount_idr, status, payment_method, payer_note, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'manual_transfer', ?, ?)
         RETURNING *`,
        [
          crypto.randomUUID(),
          invoiceNumber,
          createdSchoolId,
          createdUser.id,
          rawPlan,
          billingCycle,
          amountIdr,
          `Pendaftaran awal paket ${planDef.name} (${billingCycle})`,
          nowIso,
        ]
      );
    }

    const { token } = await createServerSession({
      userId: createdUser.id,
      schoolId: createdSchoolId,
      role: 'admin',
      tokenVersion: 1,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || '',
      request,
    });

    await logSecurityEvent({
      schoolId: createdSchoolId,
      userId: createdUser.id,
      action: 'SCHOOL_REGISTERED',
      targetType: 'school',
      targetId: createdSchoolId,
      ipAddress: ip,
      metadata: { plan: rawPlan, billingCycle },
    });

    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: createdUser.id,
          username: createdUser.username,
          full_name: createdUser.full_name,
          role: 'admin',
          school_id: createdSchoolId,
          school: toSchoolDTO(schoolRow),
        },
        invoice: initialInvoice,
      },
      {
        status: 201,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    if (createdSchoolId) {
      try {
        await dbExec(`DELETE FROM schools WHERE id = ?`, [createdSchoolId]);
      } catch {
        // ignore cleanup failure
      }
    }
    return handleApiError(error);
  }
}
