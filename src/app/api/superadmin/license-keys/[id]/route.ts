import { NextResponse } from 'next/server';
import { dbExec } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertValidUuid } from '@/lib/sanitize';
import { handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['superadmin'] });
    const { id } = await context.params;
    const keyId = assertValidUuid(id, 'ID Lisensi');

    await dbExec(`UPDATE license_keys SET is_active = 0 WHERE id = ?`, [keyId]);

    await logSecurityEvent({
      userId: ctx.user.id,
      action: 'LICENSE_KEY_REVOKED',
      targetType: 'license_key',
      targetId: keyId,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
