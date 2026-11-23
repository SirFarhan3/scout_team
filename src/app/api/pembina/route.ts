import { NextResponse } from 'next/server';
import { createNewUser, dbAll, dbOne, toBool } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import {
  assertSafeText,
  assertSafeUsername,
  assertStrongPassword,
  isSchoolRole,
} from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function GET() {
  try {
    const ctx = await requireAuth({
      roles: ['admin'],
      requireSchool: true,
      requireActiveSubscription: true,
    });

    const rows = await dbAll<Record<string, unknown>>(
      `SELECT id, school_id, username, full_name, role, is_active, last_login_at, created_at
       FROM users
       WHERE school_id = ? AND role <> 'superadmin'
       ORDER BY created_at DESC`,
      [ctx.school!.id]
    );

    const pembinas = rows.map((row) => ({
      ...row,
      is_active: toBool(row.is_active),
    }));

    return NextResponse.json({ success: true, pembinas });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ValidationError('Payload tidak valid.');

    const safeUsername = assertSafeUsername(body.username).toLowerCase();
    const safeFullName = assertSafeText(body.full_name, 'Nama Lengkap', 120);
    if (!safeFullName || safeFullName.length < 2) {
      throw new ValidationError('Nama lengkap minimal 2 karakter.');
    }
    const safePassword = assertStrongPassword(body.password, 'Password');

    if (!isSchoolRole(body.role)) {
      throw new ValidationError('Role pengguna tidak valid.');
    }

    // Cek kuota akun sekolah berdasarkan paket langganan
    const countRes = await dbOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM users WHERE school_id = ?`,
      [schoolId]
    );
    const currentUsers = Number(countRes?.cnt) || 0;

    if (currentUsers >= ctx.school!.max_users) {
      const limitMsg = `Batas maksimal admin/pembina untuk paket Anda (${ctx.school!.max_users} akun) telah tercapai. Silakan upgrade paket.`;
      return NextResponse.json(
        {
          success: false,
          code: 'MAX_USERS_REACHED',
          error: limitMsg,
          message: limitMsg,
        },
        { status: 403 }
      );
    }

    // Pastikan username belum digunakan di sekolah mana pun (1 user = 1 sekolah)
    const existing = await dbOne<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
      [safeUsername]
    );

    if (existing) {
      throw new ValidationError(
        'Username sudah terdaftar di sistem. Gunakan username lain yang unik.'
      );
    }

    const createdUser = await createNewUser({
      username: safeUsername,
      fullName: safeFullName,
      password: safePassword,
      role: body.role,
      schoolId,
    });

    await logSecurityEvent({
      schoolId,
      userId: ctx.user.id,
      action: 'PEMBINA_CREATED',
      targetType: 'user',
      targetId: createdUser.id,
      ipAddress: getClientIp(request),
      metadata: { role: body.role },
    });

    return NextResponse.json({ success: true, pembina: createdUser }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
