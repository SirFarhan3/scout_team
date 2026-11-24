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
import { topupAiCredits } from '@/lib/aiCredits';
import { generateInvoiceNumber } from '@/lib/invoices';
import { ValidationError, handleApiError, requireAuth, toSchoolDTO } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import type { VoucherType } from '@/types/school';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['admin'], requireSchool: true });

    const ip = getClientIp(request);
    const limit = checkRateLimit(`redeem:${ctx.school!.id}:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan aktivasi kode voucher/lisensi. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const rawCode = assertSafeText(body?.licenseCode || '', 'Kode Voucher / Lisensi', 64)
      .toUpperCase()
      .replace(/\s+/g, '');

    if (!rawCode || rawCode.length < 8) {
      throw new ValidationError('Kode voucher atau lisensi tidak valid.');
    }

    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const rawCodeNoDash = rawCode.replace(/-/g, '');

    let keyRow = await dbOne<Record<string, unknown>>(
      `SELECT * FROM license_keys
       WHERE code_hash = ?
          OR UPPER(TRIM(code_preview)) = ?
          OR REPLACE(UPPER(TRIM(code_preview)), '-', '') = ?
       LIMIT 1`,
      [codeHash, rawCode, rawCodeNoDash]
    );

    // Fallback untuk voucher yang dibuat sebelum fitur preview penuh (cocokkan prefix + 4 digit akhir)
    if (!keyRow && rawCode.length >= 8) {
      const prefix = rawCode.slice(0, 4);
      const suffix = rawCode.slice(-4);
      if (/^[A-Z]{3}-$/.test(prefix) && /^[A-Z0-9]{4}$/.test(suffix)) {
        keyRow = await dbOne<Record<string, unknown>>(
          `SELECT * FROM license_keys
           WHERE UPPER(code_preview) LIKE ?
           ORDER BY is_active DESC, created_at DESC
           LIMIT 1`,
          [`${prefix}%${suffix}`]
        );
      }
    }

    if (!keyRow) {
      await logSecurityEvent({
        schoolId: ctx.school!.id,
        userId: ctx.user.id,
        action: 'LICENSE_REDEEM_INVALID',
        ipAddress: ip,
      });
      throw new ValidationError('Kode voucher/lisensi tidak ditemukan atau salah ketik.');
    }

    if (!toBool(keyRow.is_active)) {
      throw new ValidationError('Kode voucher/lisensi sudah tidak aktif atau sudah habis digunakan.');
    }
    if (keyRow.expires_at && new Date(String(keyRow.expires_at)).getTime() <= Date.now()) {
      throw new ValidationError('Kode voucher/lisensi telah kadaluarsa.');
    }
    if (Number(keyRow.used_count) >= Number(keyRow.max_uses)) {
      throw new ValidationError('Kode voucher/lisensi sudah habis terpakai.');
    }

    const voucherType: VoucherType =
      keyRow.voucher_type === 'ai_tokens' || keyRow.voucher_type === 'extend_days'
        ? keyRow.voucher_type
        : 'plan';
    const bonusAiTokens = Math.max(0, Number(keyRow.ai_tokens) || 0);
    const durationDays = Math.max(0, Number(keyRow.duration_days) || 0);

    const currentUsedCount = Number(keyRow.used_count);
    const nextUsedCount = currentUsedCount + 1;
    const stillActive = nextUsedCount < Number(keyRow.max_uses);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

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
      throw new ValidationError('Kode voucher/lisensi sedang atau sudah digunakan. Silakan periksa kembali.');
    }

    const invoiceNumber = await generateInvoiceNumber(new Date(nowMs));
    const rawPreview = String(keyRow.code_preview || '');
    const maskedCodeForLog = rawPreview.includes('*')
      ? rawPreview
      : `${rawPreview.slice(0, 4)}****${rawPreview.slice(-4)}`;
    let responseMessage = '';

    // =========================================================================
    // TIPE 1: VOUCHER TOKEN GENERATE AI ('ai_tokens')
    // =========================================================================
    if (voucherType === 'ai_tokens') {
      if (bonusAiTokens <= 0) {
        throw new ValidationError('Jumlah Token AI pada voucher ini tidak valid.');
      }

      await topupAiCredits(
        ctx.school!.id,
        bonusAiTokens,
        ctx.user.id,
        `voucher_redeem:${maskedCodeForLog}`
      );

      await dbExec(
        `INSERT INTO invoices (
           id, invoice_number, school_id, school_name, gugusdepan, contact_name, contact_email,
           item_type, item_code, item_name, item_description,
           period_start, period_end, amount, discount, total_amount,
           payment_method, status, paid_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'topup', ?, ?, ?, NULL, NULL, 0, 0, 0, 'Kode Voucher Token AI', 'paid', ?, ?)`,
        [
          crypto.randomUUID(),
          invoiceNumber,
          ctx.school!.id,
          ctx.school!.name,
          ctx.school!.gugusdepan || null,
          ctx.school!.contact_name || null,
          ctx.school!.contact_email || null,
          `voucher_ai_${bonusAiTokens}`,
          `Voucher +${bonusAiTokens} Token Generate AI`,
          `Klaim Kode Voucher ${maskedCodeForLog} (+${bonusAiTokens} Token AI Rollover)`,
          nowIso,
          nowIso,
        ]
      );

      responseMessage = `🎉 Voucher berhasil diklaim! +${bonusAiTokens} Token Generate AI telah ditambahkan ke saldo sekolah Anda.`;
    }
    // =========================================================================
    // TIPE 2: VOUCHER TAMBAHAN MASA AKTIF ('extend_days')
    // =========================================================================
    else if (voucherType === 'extend_days') {
      const currentExpiresMs = new Date(ctx.school!.subscription_expires_at).getTime();
      const baseMs =
        ctx.school!.subscription_active && !Number.isNaN(currentExpiresMs) && currentExpiresMs > nowMs
          ? currentExpiresMs
          : nowMs;

      const newExpiresAt = new Date(
        baseMs + durationDays * 24 * 60 * 60 * 1000
      ).toISOString();
      const nextStatus = ctx.school!.subscription_plan === 'trial' ? 'trial' : 'active';

      await dbExec(
        `UPDATE schools
         SET subscription_status = ?, subscription_expires_at = ?, updated_at = ?
         WHERE id = ?`,
        [nextStatus, newExpiresAt, nowIso, ctx.school!.id]
      );

      if (bonusAiTokens > 0) {
        await topupAiCredits(
          ctx.school!.id,
          bonusAiTokens,
          ctx.user.id,
          `voucher_redeem:${maskedCodeForLog}`
        );
      }

      const periodStartIso = new Date(baseMs).toISOString();
      await dbExec(
        `INSERT INTO invoices (
           id, invoice_number, school_id, school_name, gugusdepan, contact_name, contact_email,
           item_type, item_code, item_name, item_description,
           period_start, period_end, amount, discount, total_amount,
           payment_method, status, paid_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'subscription', ?, ?, ?, ?, ?, 0, 0, 0, 'Kode Voucher Masa Aktif', 'paid', ?, ?)`,
        [
          crypto.randomUUID(),
          invoiceNumber,
          ctx.school!.id,
          ctx.school!.name,
          ctx.school!.gugusdepan || null,
          ctx.school!.contact_name || null,
          ctx.school!.contact_email || null,
          ctx.school!.subscription_plan,
          `Voucher Tambahan Masa Aktif +${durationDays} Hari`,
          `Klaim Kode Voucher ${maskedCodeForLog} (+${durationDays} hari${bonusAiTokens > 0 ? ` & +${bonusAiTokens} Token AI` : ''})`,
          periodStartIso,
          newExpiresAt,
          nowIso,
          nowIso,
        ]
      );

      const expDateFormatted = new Date(newExpiresAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      responseMessage = `🎉 Voucher berhasil diklaim! Masa aktif sekolah bertambah +${durationDays} hari (aktif hingga ${expDateFormatted})${
        bonusAiTokens > 0 ? ` beserta bonus +${bonusAiTokens} Token AI` : ''
      }.`;
    }
    // =========================================================================
    // TIPE 3: LISENSI PAKET LANGGANAN ('plan': basic / pro)
    // =========================================================================
    else {
      const rawPlanCode = keyRow.plan_code === 'enterprise' ? 'pro' : keyRow.plan_code;
      if (!isPaidPlanCode(rawPlanCode)) {
        throw new ValidationError('Paket pada kode lisensi tidak valid.');
      }
      const keyPlanCode: PaidPlanCode = rawPlanCode;
      const planDef = SUBSCRIPTION_PLANS[keyPlanCode];

      const currentExpiresMs = new Date(ctx.school!.subscription_expires_at).getTime();
      const baseMs =
        ctx.school!.subscription_active && !Number.isNaN(currentExpiresMs) && currentExpiresMs > nowMs
          ? currentExpiresMs
          : nowMs;

      const newExpiresAt = new Date(
        baseMs + durationDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const nextPlanCredits = planDef.aiPlanCredits;
      await dbExec(
        `UPDATE schools
         SET subscription_plan = ?, subscription_status = 'active', subscription_expires_at = ?,
             max_students = ?, max_users = ?, ai_features_enabled = ?, ai_plan_credits = ?, updated_at = ?
         WHERE id = ?`,
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

      if (bonusAiTokens > 0) {
        await topupAiCredits(
          ctx.school!.id,
          bonusAiTokens,
          ctx.user.id,
          `voucher_bonus:${maskedCodeForLog}`
        );
      }

      const periodStartIso = new Date(baseMs).toISOString();
      await dbExec(
        `INSERT INTO invoices (
           id, invoice_number, school_id, school_name, gugusdepan, contact_name, contact_email,
           item_type, item_code, item_name, item_description,
           period_start, period_end, amount, discount, total_amount,
           payment_method, status, paid_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'subscription', ?, ?, ?, ?, ?, ?, ?, 0, 'Kode Lisensi / Voucher', 'paid', ?, ?)`,
        [
          crypto.randomUUID(),
          invoiceNumber,
          ctx.school!.id,
          ctx.school!.name,
          ctx.school!.gugusdepan || null,
          ctx.school!.contact_name || null,
          ctx.school!.contact_email || null,
          keyPlanCode,
          `Aktivasi Lisensi ${planDef.name}`,
          `Kode Lisensi ${maskedCodeForLog} (${durationDays} hari${
            bonusAiTokens > 0 ? ` + Bonus ${bonusAiTokens} Token AI` : ''
          })`,
          periodStartIso,
          newExpiresAt,
          planDef.price,
          planDef.price,
          nowIso,
          nowIso,
        ]
      );

      const expDateFormatted = new Date(newExpiresAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      responseMessage = `🎉 Lisensi berhasil diaktifkan! ${planDef.name} aktif hingga ${expDateFormatted}${
        bonusAiTokens > 0 ? ` (+${bonusAiTokens} Token AI Top-Up)` : ''
      }.`;
    }

    const updatedSchool = await dbOne<Record<string, unknown>>(
      `SELECT * FROM schools WHERE id = ? LIMIT 1`,
      [ctx.school!.id]
    );

    if (!updatedSchool) {
      throw new Error('Gagal memuat pembaruan sekolah.');
    }

    await logSecurityEvent({
      schoolId: ctx.school!.id,
      userId: ctx.user.id,
      action: 'VOUCHER_OR_LICENSE_REDEEMED',
      targetType: 'license_key',
      targetId: String(keyRow.id),
      ipAddress: ip,
      metadata: {
        voucherType,
        plan: keyRow.plan_code,
        durationDays,
        aiTokens: bonusAiTokens,
      },
    });

    return NextResponse.json({
      success: true,
      message: responseMessage,
      school: toSchoolDTO(updatedSchool),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
