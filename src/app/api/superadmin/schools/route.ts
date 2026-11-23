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
import {
  assertSafeText,
  assertSafeUsername,
  assertStrongPassword,
  slugifySchoolName,
} from '@/lib/sanitize';
import {
  SUBSCRIPTION_PLANS,
  isSubscriptionPlanCode,
  type SubscriptionPlanCode,
} from '@/lib/subscription-plans';
import { ValidationError, handleApiError, requireAuth, toSchoolDTO } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  let createdSchoolId: string | null = null;
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['superadmin'] });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload tidak valid.');
    }

    const schoolName = assertSafeText(body.schoolName, 'Nama Sekolah', 120)
      .replace(/\s+/g, ' ')
      .trim();
    const city = assertSafeText(body.city || 'Indonesia', 'Kota', 80);
    const gugusdepan = assertSafeText(body.gugusdepan || '', 'Gugusdepan', 100);
    const npsn = assertSafeText(body.npsn || '', 'NPSN', 30);
    const adminFullName = assertSafeText(body.adminFullName, 'Nama Lengkap Admin', 120);
    const adminUsername = assertSafeUsername(body.adminUsername).toLowerCase();
    const adminPassword = assertStrongPassword(body.adminPassword, 'Password Admin');

    if (schoolName.length < 3) throw new ValidationError('Nama sekolah minimal 3 karakter.');
    if (adminFullName.length < 2) throw new ValidationError('Nama admin minimal 2 karakter.');

    const planCode: SubscriptionPlanCode = isSubscriptionPlanCode(body.plan) ? body.plan : 'pro';
    const planDef = SUBSCRIPTION_PLANS[planCode];
    const durationDays = Math.max(
      1,
      Math.min(3650, Number(body.durationDays) || planDef.durationDays)
    );
    const status = planCode === 'trial' ? 'trial' : 'active';

    const existingSchool = await dbOne<{ id: string; name: string }>(
      `SELECT id, name FROM schools WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1`,
      [schoolName]
    );

    if (existingSchool) {
      throw new ValidationError(
        `Sekolah "${existingSchool.name}" sudah terdaftar. Nama sekolah tidak boleh sama.`
      );
    }

    const existingUser = await dbOne<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
      [adminUsername]
    );

    if (existingUser) {
      throw new ValidationError('Username admin sudah digunakan.');
    }

    const slug = `${slugifySchoolName(schoolName)}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const schoolId = crypto.randomUUID();

    const initialPlanCredits = planDef.aiPlanCredits;
    const schoolRow = await dbOne<Record<string, unknown>>(
      `INSERT INTO schools (
         id, name, slug, npsn, city, gugusdepan, contact_name,
         subscription_plan, subscription_status, subscription_started_at, subscription_expires_at,
         max_students, max_users, ai_features_enabled, ai_plan_credits, ai_topup_credits, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       RETURNING *`,
      [
        schoolId,
        schoolName,
        slug,
        npsn || null,
        city || 'Indonesia',
        gugusdepan || `Gugusdepan ${schoolName}`,
        adminFullName,
        planCode,
        status,
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
      throw new Error('Gagal membuat sekolah.');
    }
    createdSchoolId = String(schoolRow.id);

    await dbExec(
      `INSERT INTO ai_credit_logs (id, school_id, user_id, type, source, amount, feature, created_at)
       VALUES (?, ?, ?, 'plan_reset', 'plan', ?, ?, ?)`,
      [crypto.randomUUID(), createdSchoolId, ctx.user.id, initialPlanCredits, `superadmin_create:${planCode}`, nowIso]
    );

    let createdUser;
    try {
      createdUser = await createNewUser({
        username: adminUsername,
        fullName: adminFullName,
        password: adminPassword,
        role: 'admin',
        schoolId: createdSchoolId,
      });
    } catch (userErr: unknown) {
      await dbExec(`DELETE FROM schools WHERE id = ?`, [createdSchoolId]);
      createdSchoolId = null;
      const msg = userErr instanceof Error ? userErr.message : String(userErr || '');
      throw new ValidationError(msg || 'Gagal membuat akun admin sekolah.');
    }

    await seedDefaultPointPresets(createdSchoolId);

    await logSecurityEvent({
      schoolId: createdSchoolId,
      userId: ctx.user.id,
      action: 'SUPERADMIN_CREATED_SCHOOL',
      targetType: 'school',
      targetId: createdSchoolId,
      ipAddress: getClientIp(request),
      metadata: { planCode, durationDays },
    });

    return NextResponse.json(
      {
        success: true,
        school: toSchoolDTO(schoolRow),
        adminUser: createdUser,
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdSchoolId) {
      try {
        await dbExec(`DELETE FROM schools WHERE id = ?`, [createdSchoolId]);
      } catch {
        // ignore
      }
    }
    return handleApiError(error);
  }
}
