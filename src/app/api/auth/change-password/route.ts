import { NextResponse } from 'next/server';
import { dbExec, dbOne, hashPassword, verifyPassword } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertStrongPassword } from '@/lib/sanitize';
import { createServerSession, revokeAllUserSessions } from '@/lib/session';
import { AuthError, ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload tidak valid.');
    }

    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!currentPassword) {
      throw new ValidationError('Password saat ini wajib diisi.');
    }
    const newPassword = assertStrongPassword(body.newPassword, 'Password Baru');

    if (currentPassword === newPassword) {
      throw new ValidationError('Password baru tidak boleh sama dengan password lama.');
    }

    const userRow = await dbOne<{ password_hash: string; token_version: number }>(
      `SELECT password_hash, token_version FROM users WHERE id = ? LIMIT 1`,
      [ctx.user.id]
    );

    const isValid =
      userRow && (await verifyPassword(currentPassword, String(userRow.password_hash || '')));
    if (!isValid) {
      throw new AuthError('Password saat ini tidak sesuai.', 400, 'INVALID_PASSWORD');
    }

    const hashedPassword = await hashPassword(newPassword);
    const nextTokenVersion = (Number(userRow?.token_version) || 1) + 1;

    await dbExec(`UPDATE users SET password_hash = ?, token_version = ? WHERE id = ?`, [
      hashedPassword,
      nextTokenVersion,
      ctx.user.id,
    ]);

    // Cabut semua sesi lama lalu terbitkan sesi baru untuk browser ini
    await revokeAllUserSessions(ctx.user.id);
    const { token } = await createServerSession({
      userId: ctx.user.id,
      schoolId: ctx.user.school_id,
      role: ctx.user.role,
      tokenVersion: nextTokenVersion,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || '',
      request,
    });

    await logSecurityEvent({
      schoolId: ctx.user.school_id,
      userId: ctx.user.id,
      action: 'PASSWORD_CHANGED',
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      {
        success: true,
        token,
        message: 'Password berhasil diperbarui dan semua sesi perangkat lain telah keluar.',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
