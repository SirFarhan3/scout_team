import { NextResponse } from 'next/server';
import { dbAll, dbOne, hashPassword, toBool, toSqlBool } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import {
  assertSafeText,
  assertSafeUsername,
  assertStrongPassword,
  assertValidUuid,
  isSchoolRole,
} from '@/lib/sanitize';
import { revokeAllUserSessions } from '@/lib/session';
import { AuthError, ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const { id } = await context.params;
    const targetId = assertValidUuid(id, 'ID User');

    if (targetId === ctx.user.id) {
      throw new AuthError(
        'Anda tidak bisa mengedit atau mengubah role akun Anda sendiri yang sedang aktif login!',
        403,
        'SELF_EDIT_FORBIDDEN'
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ValidationError('Payload tidak valid.');

    const targetUser = await dbOne<{
      id: string;
      school_id: string;
      role: string;
      token_version: number;
    }>(
      `SELECT id, school_id, role, token_version
       FROM users
       WHERE id = ? AND school_id = ? AND role <> 'superadmin'
       LIMIT 1`,
      [targetId, schoolId]
    );

    if (!targetUser) {
      throw new ValidationError('Akun pengelola tidak ditemukan di sekolah Anda.');
    }

    const safeUsername = assertSafeUsername(body.username).toLowerCase();
    const safeFullName = assertSafeText(body.full_name, 'Nama Lengkap', 120);
    if (!safeFullName || safeFullName.length < 2) {
      throw new ValidationError('Nama lengkap minimal 2 karakter.');
    }
    if (!isSchoolRole(body.role)) {
      throw new ValidationError('Role pengguna tidak valid.');
    }

    const dupUser = await dbOne<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1`,
      [safeUsername, targetId]
    );

    if (dupUser) {
      throw new ValidationError('Username tersebut sudah dipakai oleh akun lain.');
    }

    const setClauses: string[] = ['username = ?', 'full_name = ?', 'role = ?'];
    const args: Array<string | number | null> = [safeUsername, safeFullName, body.role];

    let shouldRevokeSessions = targetUser.role !== body.role;

    if (typeof body.is_active === 'boolean') {
      setClauses.push('is_active = ?');
      args.push(toSqlBool(body.is_active));
      if (!body.is_active) shouldRevokeSessions = true;
    }

    if (typeof body.password === 'string' && body.password.trim() !== '') {
      const strongPass = assertStrongPassword(body.password, 'Password Baru');
      const hashedPassword = await hashPassword(strongPass);
      setClauses.push('password_hash = ?');
      args.push(hashedPassword);
      shouldRevokeSessions = true;
    }

    if (shouldRevokeSessions) {
      setClauses.push('token_version = ?');
      args.push((Number(targetUser.token_version) || 1) + 1);
    }

    args.push(targetId, schoolId);

    const updated = await dbOne<Record<string, unknown>>(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE id = ? AND school_id = ? AND role <> 'superadmin'
       RETURNING id, school_id, username, full_name, role, is_active, last_login_at, created_at`,
      args
    );

    if (!updated) {
      throw new Error('Gagal memperbarui akun pengelola.');
    }

    if (shouldRevokeSessions) {
      await revokeAllUserSessions(targetId);
    }

    await logSecurityEvent({
      schoolId,
      userId: ctx.user.id,
      action: 'PEMBINA_UPDATED',
      targetType: 'user',
      targetId,
      ipAddress: getClientIp(request),
      metadata: { role: body.role, revokedSessions: shouldRevokeSessions },
    });

    return NextResponse.json({
      success: true,
      pembina: {
        ...updated,
        is_active: toBool(updated.is_active),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const { id } = await context.params;
    const targetId = assertValidUuid(id, 'ID User');

    if (targetId === ctx.user.id) {
      throw new AuthError(
        'Anda tidak bisa menghapus akun Anda sendiri yang sedang aktif login!',
        403,
        'SELF_DELETE_FORBIDDEN'
      );
    }

    await revokeAllUserSessions(targetId);

    const deleted = await dbAll<{ id: string }>(
      `DELETE FROM users
       WHERE id = ? AND school_id = ? AND role <> 'superadmin'
       RETURNING id`,
      [targetId, schoolId]
    );

    if (deleted.length === 0) {
      throw new ValidationError('Akun pengelola tidak ditemukan di sekolah Anda.');
    }

    await logSecurityEvent({
      schoolId,
      userId: ctx.user.id,
      action: 'PEMBINA_DELETED',
      targetType: 'user',
      targetId,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
