import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbOne, toBool } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { isPaidPlanCode } from '@/lib/plans';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';
import type { PaidPlanCode, VoucherType } from '@/types/school';

function generateVoucherCode(prefix = 'SCT'): string {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${seg()}-${seg()}-${seg()}`;
}

function isVoucherType(val: unknown): val is VoucherType {
  return val === 'plan' || val === 'ai_tokens' || val === 'extend_days';
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['superadmin'] });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload tidak valid.');
    }

    const voucherType: VoucherType = isVoucherType(body.voucherType)
      ? body.voucherType
      : 'plan';

    let planCode: PaidPlanCode = 'pro';
    let durationDays = 1;
    let aiTokens = Math.max(0, Math.min(10000, Math.floor(Number(body.aiTokens) || 0)));
    let codePrefix = 'SCT';

    if (voucherType === 'ai_tokens') {
      if (aiTokens < 1 || aiTokens > 10000) {
        throw new ValidationError('Jumlah Token AI pada voucher harus antara 1 sampai 10.000 token.');
      }
      planCode = 'pro'; // Memenuhi CHECK constraint DB
      durationDays = 1; // Memenuhi CHECK (duration_days > 0) di DB
      codePrefix = 'VAI';
    } else if (voucherType === 'extend_days') {
      durationDays = Math.floor(Number(body.durationDays));
      if (Number.isNaN(durationDays) || durationDays < 1 || durationDays > 3650) {
        throw new ValidationError('Tambahan masa aktif harus antara 1 sampai 3650 hari.');
      }
      planCode = 'pro'; // Memenuhi CHECK constraint DB
      codePrefix = 'VEX';
    } else {
      // voucherType === 'plan'
      if (!isPaidPlanCode(body.planCode)) {
        throw new ValidationError('Paket lisensi tidak valid (pilih Basic atau Pro).');
      }
      planCode = body.planCode;
      durationDays = Math.floor(Number(body.durationDays));
      if (Number.isNaN(durationDays) || durationDays < 1 || durationDays > 3650) {
        throw new ValidationError('Durasi lisensi harus antara 1 sampai 3650 hari.');
      }
      codePrefix = 'SCT';
    }

    const maxUses = Math.max(1, Math.min(100, Number(body.maxUses) || 1));
    const plainCode = generateVoucherCode(codePrefix);
    const codeHash = crypto.createHash('sha256').update(plainCode).digest('hex');
    const codePreview = plainCode;

    const created = await dbOne<Record<string, unknown>>(
      `INSERT INTO license_keys (
         id, code_hash, code_preview, voucher_type, plan_code, duration_days, ai_tokens, max_uses,
         used_count, is_active, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
       RETURNING id, code_preview, voucher_type, plan_code, duration_days, ai_tokens, max_uses, used_count, is_active, expires_at, created_at`,
      [
        crypto.randomUUID(),
        codeHash,
        codePreview,
        voucherType,
        planCode,
        durationDays,
        aiTokens,
        maxUses,
        ctx.user.id,
        new Date().toISOString(),
      ]
    );

    if (!created) {
      throw new Error('Gagal membuat kode voucher / lisensi.');
    }

    await logSecurityEvent({
      userId: ctx.user.id,
      action: 'VOUCHER_CODE_GENERATED',
      targetType: 'license_key',
      targetId: String(created.id),
      ipAddress: getClientIp(request),
      metadata: { voucherType, planCode, durationDays, aiTokens, maxUses },
    });

    return NextResponse.json(
      {
        success: true,
        plainCode, // Ditampilkan HANYA SEKALI saat pembuatan
        licenseKey: {
          ...created,
          voucher_type: (created.voucher_type || voucherType) as VoucherType,
          ai_tokens: Number(created.ai_tokens ?? aiTokens) || 0,
          is_active: toBool(created.is_active),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
