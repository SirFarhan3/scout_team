import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbExec, dbOne, toBool, toSqlBool } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { assertSafeText } from '@/lib/sanitize';
import {
  SUBSCRIPTION_PLANS,
  isPaidPlanCode,
  type PaidPlanCode,
} from '@/lib/subscription-plans';
import { ValidationError, handleApiError, requireAuth, toSchoolDTO } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['admin'], requireSchool: true });

    const ip = getClientIp(request);
    const limit = checkRateLimit(`redeem:${ctx.school!.id}:${ip}`, 8, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan aktivasi kode lisensi. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const rawCode = assertSafeText(body?.licenseCode || '', 'Kode Lisensi', 64)
      .toUpperCase()
      .replace(/\s+/g, '');

    if (!rawCode || rawCode.length < 8) {
      throw new ValidationError('Kode lisensi tidak valid.');
    }

    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');

    const keyRow = await dbOne<Record<string, unknown>>(
      `SELECT * FROM license_keys WHERE code_hash = ? LIMIT 1`,
      [codeHash]
    );

    if (!keyRow) {
      await logSecurityEvent({
        schoolId: ctx.school!.id,
        userId: ctx.user.id,
        action: 'LICENSE_REDEEM_INVALID',
        ipAddress: ip,
      });
      throw new ValidationError('Kode lisensi tidak ditemukan atau tidak valid.');
    }

    if (!toBool(keyRow.is_active)) {
      throw new ValidationError('Kode lisensi sudah tidak aktif.');
    }
    if (keyRow.expires_at && new Date(String(keyRow.expires_at)).getTime() <= Date.now()) {
      throw new ValidationError('Kode lisensi telah kadaluarsa.');
    }
    if (Number(keyRow.used_count) >= Number(keyRow.max_uses)) {
      throw new ValidationError('Kode lisensi sudah habis terpakai.');
    }
    if (!isPaidPlanCode(keyRow.plan_code)) {
      throw new ValidationError('Paket pada kode lisensi tidak valid.');
    }
    const keyPlanCode: PaidPlanCode = keyRow.plan_code;

    const currentUsedCount = Number(keyRow.used_count);
    const nextUsedCount = currentUsedCount + 1;
    const stillActive = nextUsedCount < Number(keyRow.max_uses);
    const nowIso = new Date().toISOString();

    // Atomic optimistic lock agar 1 kode tidak bisa diredeem bersamaan (race condition)
    const claimedKey = await dbOne<Record<string, unknown>>(
      `UPDATE license_keys
       SET used_count = ?, is_active = ?, redeemed_by_school_id = ?, redeemed_at = ?
       WHERE id = ? AND used_count = ? AND is_active = 1
       RETURNING *`,
      [
        nextUsedCount,
        toSqlBool(stillActive),
        ctx.school!.id,
        nowIso,
        String(keyRow.id),
        currentUsedCount,
      ]
    );

    if (!claimedKey) {
      throw new ValidationError('Kode lisensi sedang atau sudah digunakan. Silakan periksa kembali.');
    }

    const planDef = SUBSCRIPTION_PLANS[keyPlanCode];
    const nowMs = Date.now();
    const currentExpiresMs = new Date(ctx.school!.subscription_expires_at).getTime();
    const baseMs =
      ctx.school!.subscription_active && !Number.isNaN(currentExpiresMs) && currentExpiresMs > nowMs
        ? currentExpiresMs
        : nowMs;

    const newExpiresAt = new Date(
      baseMs + Number(keyRow.duration_days) * 24 * 60 * 60 * 1000
    ).toISOString();

    const nextPlanCredits = planDef.aiPlanCredits;
    const updatedSchool = await dbOne<Record<string, unknown>>(
      `UPDATE schools
       SET subscription_plan = ?, subscription_status = 'active', subscription_expires_at = ?,
           max_students = ?, max_users = ?, ai_features_enabled = ?, ai_plan_credits = ?, updated_at = ?
       WHERE id = ?
       RETURNING *`,
      [
        keyPlanCode,
        newExpiresAt,
        planDef.maxStudents,
        planDef.maxUsers,
        toSqlBool(planDef.aiFeaturesEnabled),
        nextPlanCredits,
        nowIso,
        ctx.school!.id,
      ]
    );

    if (!updatedSchool) {
      throw new Error('Gagal mengaktifkan langganan sekolah.');
    }

    await dbExec(
      `INSERT INTO ai_credit_logs (id, school_id, user_id, type, source, amount, feature, created_at)
       VALUES (?, ?, ?, 'plan_reset', 'plan', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        ctx.school!.id,
        ctx.user.id,
        nextPlanCredits,
        `license_redeem:${keyPlanCode}`,
        nowIso,
      ]
    );

    const invoiceNumber = `LIC-${nowIso.slice(0, 10).replace(/-/g, '')}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    await dbExec(
      `INSERT INTO subscription_invoices (
         id, invoice_number, school_id, requested_by, plan_code, billing_cycle, amount_idr,
         status, payment_method, payment_reference, payer_note, verified_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, 'paid', 'license_key', ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        invoiceNumber,
        ctx.school!.id,
        ctx.user.id,
        keyPlanCode,
        Number(keyRow.duration_days) >= 360 ? 'yearly' : 'monthly',
        String(keyRow.code_preview),
        `Aktivasi kode lisensi (${keyRow.duration_days} hari)`,
        nowIso,
        nowIso,
      ]
    );

    await logSecurityEvent({
      schoolId: ctx.school!.id,
      userId: ctx.user.id,
      action: 'LICENSE_REDEEMED',
      targetType: 'license_key',
      targetId: String(keyRow.id),
      ipAddress: ip,
      metadata: { plan: keyPlanCode, durationDays: keyRow.duration_days },
    });

    return NextResponse.json({
      success: true,
      message: `Lisensi berhasil diaktifkan! Paket ${planDef.name} aktif hingga ${new Date(
        newExpiresAt
      ).toLocaleDateString('id-ID')}.`,
      school: toSchoolDTO(updatedSchool),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
