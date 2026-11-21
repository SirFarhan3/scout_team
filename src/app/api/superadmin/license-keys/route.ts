import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbOne, toBool } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { isPaidPlanCode } from '@/lib/plans';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

function generateLicenseCode(): string {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SCT-${seg()}-${seg()}-${seg()}`;
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['superadmin'] });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload tidak valid.');
    }

    if (!isPaidPlanCode(body.planCode)) {
      throw new ValidationError('Paket lisensi tidak valid.');
    }

    const durationDays = Number(body.durationDays);
    if (Number.isNaN(durationDays) || durationDays < 1 || durationDays > 3650) {
      throw new ValidationError('Durasi lisensi harus antara 1 sampai 3650 hari.');
    }

    const maxUses = Math.max(1, Math.min(100, Number(body.maxUses) || 1));
    const plainCode = generateLicenseCode();
    const codeHash = crypto.createHash('sha256').update(plainCode).digest('hex');
    const codePreview = `${plainCode.slice(0, 4)}****${plainCode.slice(-4)}`;

    const created = await dbOne<Record<string, unknown>>(
      `INSERT INTO license_keys (
         id, code_hash, code_preview, plan_code, duration_days, max_uses,
         used_count, is_active, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
       RETURNING id, code_preview, plan_code, duration_days, max_uses, used_count, is_active, expires_at, created_at`,
      [
        crypto.randomUUID(),
        codeHash,
        codePreview,
        body.planCode,
        durationDays,
        maxUses,
        ctx.user.id,
        new Date().toISOString(),
      ]
    );

    if (!created) {
      throw new Error('Gagal membuat kode lisensi.');
    }

    await logSecurityEvent({
      userId: ctx.user.id,
      action: 'LICENSE_KEY_GENERATED',
      targetType: 'license_key',
      targetId: String(created.id),
      ipAddress: getClientIp(request),
      metadata: { planCode: body.planCode, durationDays, maxUses },
    });

    return NextResponse.json(
      {
        success: true,
        plainCode, // Ditampilkan HANYA SEKALI saat pembuatan
        licenseKey: {
          ...created,
          is_active: toBool(created.is_active),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
