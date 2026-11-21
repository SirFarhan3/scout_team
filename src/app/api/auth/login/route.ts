import { NextResponse } from 'next/server';
import { dbExec, dbOne, toBool, verifyPassword } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { assertSafeUsername, isAllowedRole } from '@/lib/sanitize';
import { createServerSession } from '@/lib/session';
import { AuthError, ValidationError, handleApiError, toSchoolDTO } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);

    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`login:ip:${ip}`, 25, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${ipLimit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload login tidak valid.');
    }

    const rawUsername = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rawUsername.trim() || !password) {
      throw new ValidationError('Username dan password wajib diisi!');
    }
    if (password.length > 128) {
      throw new ValidationError('Password terlalu panjang.');
    }

    const cleanUsername = assertSafeUsername(rawUsername).toLowerCase();

    const userLimit = checkRateLimit(`login:user:${cleanUsername}`, 12, 15 * 60 * 1000);
    if (!userLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan untuk akun ini. Coba lagi dalam ${userLimit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const foundUser = await dbOne<Record<string, unknown>>(
      `SELECT id, username, full_name, password_hash, role, school_id, is_active,
              token_version, failed_login_attempts, locked_until
       FROM users
       WHERE LOWER(username) = LOWER(?)
       LIMIT 1`,
      [cleanUsername]
    );

    if (!foundUser) {
      await logSecurityEvent({
        action: 'LOGIN_FAILED_UNKNOWN_USER',
        ipAddress: ip,
        metadata: { username: cleanUsername },
      });
      throw new AuthError('Username atau password salah!', 401, 'INVALID_CREDENTIALS');
    }

    const foundUserId = String(foundUser.id);
    const foundSchoolId = foundUser.school_id ? String(foundUser.school_id) : null;

    if (
      foundUser.locked_until &&
      new Date(String(foundUser.locked_until)).getTime() > Date.now()
    ) {
      await logSecurityEvent({
        schoolId: foundSchoolId,
        userId: foundUserId,
        action: 'LOGIN_BLOCKED_LOCKED',
        ipAddress: ip,
      });
      throw new AuthError(
        'Akun sementara dikunci karena terlalu banyak percobaan gagal. Silakan tunggu 15 menit.',
        429,
        'ACCOUNT_LOCKED'
      );
    }

    const isValid = await verifyPassword(password, String(foundUser.password_hash || ''));

    if (!isValid) {
      const nextAttempts = (Number(foundUser.failed_login_attempts) || 0) + 1;
      const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
      await dbExec(
        `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`,
        [
          nextAttempts,
          shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
            : null,
          foundUserId,
        ]
      );

      await logSecurityEvent({
        schoolId: foundSchoolId,
        userId: foundUserId,
        action: shouldLock ? 'ACCOUNT_LOCKED_BRUTE_FORCE' : 'LOGIN_FAILED_BAD_PASSWORD',
        ipAddress: ip,
      });

      throw new AuthError('Username atau password salah!', 401, 'INVALID_CREDENTIALS');
    }

    if (!toBool(foundUser.is_active)) {
      throw new AuthError(
        'Akun Anda sedang dinonaktifkan. Hubungi Admin Sekolah Anda.',
        403,
        'ACCOUNT_DISABLED'
      );
    }

    if (!isAllowedRole(foundUser.role)) {
      throw new AuthError('Role pengguna tidak valid.', 403, 'INVALID_ROLE');
    }

    // Validasi aturan ketat 1 user = 1 sekolah
    if (foundUser.role !== 'superadmin' && !foundSchoolId) {
      throw new AuthError(
        'Akun belum terikat ke sekolah manapun. Hubungi Administrator.',
        403,
        'SCHOOL_REQUIRED'
      );
    }

    let schoolDto = null;
    if (foundSchoolId) {
      const schoolRow = await dbOne<Record<string, unknown>>(
        `SELECT * FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [foundSchoolId]
      );

      if (!schoolRow) {
        throw new AuthError('Sekolah yang terdaftar tidak ditemukan atau telah dihapus.', 403, 'SCHOOL_NOT_FOUND');
      }
      schoolDto = toSchoolDTO(schoolRow);
    }

    // Reset counter gagal login & update waktu login terakhir
    await dbExec(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?`,
      [new Date().toISOString(), foundUserId]
    );

    const { token } = await createServerSession({
      userId: foundUserId,
      schoolId: foundSchoolId,
      role: foundUser.role,
      tokenVersion: Number(foundUser.token_version) || 1,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || '',
      request,
    });

    await logSecurityEvent({
      schoolId: foundSchoolId,
      userId: foundUserId,
      action: 'LOGIN_SUCCESS',
      ipAddress: ip,
    });

    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: foundUserId,
          username: String(foundUser.username),
          full_name: String(foundUser.full_name),
          role: foundUser.role,
          school_id: foundSchoolId,
          school: schoolDto,
        },
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
