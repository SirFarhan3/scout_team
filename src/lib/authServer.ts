import 'server-only';
import { NextResponse } from 'next/server';
import { dbOne, toBool } from '@/lib/turso';
import {
  clearServerSessionCookie,
  extractBearerTokenFromHeaders,
  hashSessionLookupToken,
  readSignedSessionFromCookies,
  readSignedSessionFromHeaders,
} from '@/lib/session';
import { signSessionToken } from '@/lib/sessionToken';
import { CsrfError } from '@/lib/serverSecurity';
import { getRemainingDays, isSchoolSubscriptionActive } from '@/lib/plans';
import { SUBSCRIPTION_PLANS, normalizePlanCode } from '@/lib/subscription-plans';
import { isAllowedRole, AllowedRole } from '@/lib/sanitize';
import type { SchoolDTO } from '@/types/school';

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface AuthenticatedUserDTO {
  id: string;
  username: string;
  full_name: string;
  role: AllowedRole;
  school_id: string | null;
  is_active: boolean;
}

export interface VerifiedAuthContext {
  sessionId: string;
  token: string;
  user: AuthenticatedUserDTO;
  school: SchoolDTO | null;
}

export function toSchoolDTO(row: Record<string, unknown>): SchoolDTO {
  const active = isSchoolSubscriptionActive({
    subscription_status: typeof row.subscription_status === 'string' ? row.subscription_status : null,
    subscription_expires_at:
      typeof row.subscription_expires_at === 'string' ? row.subscription_expires_at : null,
  });
  const expiresAt = String(row.subscription_expires_at || '');
  const normalizedPlan = normalizePlanCode(row.subscription_plan);
  const planConfig = SUBSCRIPTION_PLANS[normalizedPlan];
  const aiPlanCredits = Math.max(
    0,
    Number(row.ai_plan_credits ?? planConfig.aiPlanCredits) || 0
  );
  const aiTopupCredits = Math.max(0, Number(row.ai_topup_credits ?? 0) || 0);

  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    npsn: row.npsn ? String(row.npsn) : null,
    city: String(row.city || 'Indonesia'),
    address: row.address ? String(row.address) : null,
    gugusdepan: row.gugusdepan ? String(row.gugusdepan) : null,
    contact_name: row.contact_name ? String(row.contact_name) : null,
    contact_phone: row.contact_phone ? String(row.contact_phone) : null,
    contact_email: row.contact_email ? String(row.contact_email) : null,
    subscription_plan: normalizedPlan,
    subscription_status: row.subscription_status as SchoolDTO['subscription_status'],
    subscription_started_at: String(row.subscription_started_at || ''),
    subscription_expires_at: expiresAt,
    subscription_active: active,
    remaining_days: getRemainingDays(expiresAt),
    max_students: Number(row.max_students) || planConfig.maxStudents,
    max_users: Number(row.max_users) || planConfig.maxUsers,
    ai_features_enabled: toBool(row.ai_features_enabled),
    ai_plan_credits: aiPlanCredits,
    ai_topup_credits: aiTopupCredits,
    ai_total_credits: aiPlanCredits + aiTopupCredits,
    telegram_chat_id: row.telegram_chat_id ? Number(row.telegram_chat_id) : null,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

/**
 * Memverifikasi token JWT dari header Authorization: Bearer <token>
 * (atau fallback ke cookie hanya bila allowCookieFallback = true untuk bootstrap sesi)
 * + sesi database + status user + ikatan 1-user-1-sekolah.
 */
export async function getVerifiedSession(
  options: { allowCookieFallback?: boolean } = {}
): Promise<VerifiedAuthContext | null> {
  let signed = await readSignedSessionFromHeaders();
  if (!signed && options.allowCookieFallback) {
    signed = await readSignedSessionFromCookies();
  }
  if (!signed) return null;

  const expectedHash = hashSessionLookupToken(signed.sid, signed.uid);

  const sessionRow = await dbOne<Record<string, unknown>>(
    `SELECT id, user_id, school_id, token_hash, token_version, expires_at, revoked_at
     FROM user_sessions
     WHERE id = ?
     LIMIT 1`,
    [signed.sid]
  );

  if (
    !sessionRow ||
    sessionRow.revoked_at ||
    sessionRow.token_hash !== expectedHash ||
    sessionRow.user_id !== signed.uid ||
    new Date(String(sessionRow.expires_at)).getTime() <= Date.now()
  ) {
    return null;
  }

  const userRow = await dbOne<Record<string, unknown>>(
    `SELECT id, username, full_name, role, school_id, is_active, token_version
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [signed.uid]
  );

  if (
    !userRow ||
    !toBool(userRow.is_active) ||
    !isAllowedRole(userRow.role) ||
    Number(userRow.token_version) !== Number(sessionRow.token_version) ||
    Number(userRow.token_version) !== Number(signed.tv)
  ) {
    return null;
  }

  const jwtToken = await signSessionToken(signed);

  // Enfore 1 user = 1 school invariant strictly
  if (userRow.role === 'superadmin') {
    if (userRow.school_id !== null && userRow.school_id !== undefined) return null;
    return {
      sessionId: String(sessionRow.id),
      token: jwtToken,
      user: {
        id: String(userRow.id),
        username: String(userRow.username),
        full_name: String(userRow.full_name),
        role: 'superadmin',
        school_id: null,
        is_active: true,
      },
      school: null,
    };
  }

  const userSchoolId = userRow.school_id ? String(userRow.school_id) : null;
  if (!userSchoolId || userSchoolId !== signed.sch) {
    return null;
  }

  const schoolRow = await dbOne<Record<string, unknown>>(
    `SELECT * FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [userSchoolId]
  );

  if (!schoolRow) {
    return null;
  }

  return {
    sessionId: String(sessionRow.id),
    token: jwtToken,
    user: {
      id: String(userRow.id),
      username: String(userRow.username),
      full_name: String(userRow.full_name),
      role: userRow.role,
      school_id: userSchoolId,
      is_active: true,
    },
    school: toSchoolDTO(schoolRow),
  };
}

export interface RequireAuthOptions {
  roles?: readonly AllowedRole[];
  requireSchool?: boolean;
  requireActiveSubscription?: boolean;
  requireAiFeature?: boolean;
}

export async function requireAuth(
  options: RequireAuthOptions = {}
): Promise<VerifiedAuthContext> {
  const bearerToken = await extractBearerTokenFromHeaders();
  if (!bearerToken) {
    throw new AuthError(
      'Header Authorization Bearer token JWT wajib disertakan.',
      401,
      'MISSING_JWT_TOKEN'
    );
  }

  const ctx = await getVerifiedSession({ allowCookieFallback: false });
  if (!ctx) {
    await clearServerSessionCookie().catch(() => {});
    throw new AuthError('Sesi atau token JWT Anda telah berakhir atau tidak valid. Silakan login kembali.', 401, 'UNAUTHORIZED');
  }

  if (options.roles && !options.roles.includes(ctx.user.role)) {
    throw new AuthError('Anda tidak memiliki hak akses untuk tindakan ini.', 403, 'FORBIDDEN');
  }

  if (options.requireSchool) {
    if (!ctx.user.school_id || !ctx.school) {
      throw new AuthError('Akun ini tidak terikat dengan sekolah manapun.', 403, 'SCHOOL_REQUIRED');
    }
  }

  if (options.requireActiveSubscription) {
    if (!ctx.school || !ctx.school.subscription_active) {
      throw new AuthError(
        'Langganan sekolah belum aktif atau telah kadaluarsa. Silakan lakukan pembayaran/perpanjangan di menu Langganan.',
        402,
        'SUBSCRIPTION_REQUIRED'
      );
    }
  }

  if (options.requireAiFeature) {
    if (!ctx.school?.ai_features_enabled) {
      throw new AuthError(
        'Fitur AI tidak aktif pada paket sekolah Anda.',
        403,
        'AI_DISABLED'
      );
    }
  }

  return ctx;
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, code: error.code, error: error.message, message: error.message },
      { status: error.status }
    );
  }
  if (error instanceof CsrfError) {
    return NextResponse.json(
      { success: false, code: 'CSRF_FORBIDDEN', error: error.message, message: error.message },
      { status: 403 }
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', error: error.message, message: error.message },
      { status: 400 }
    );
  }

  const msg = error instanceof Error ? error.message : 'Terjadi kesalahan pada server.';
  // Pesan validasi bisnis dari assertSafeText / quota / duplikat aman dikembalikan sebagai 400
  const isKnownInputError =
    msg.includes('ditolak') ||
    msg.includes('terlalu panjang') ||
    msg.includes('wajib') ||
    msg.includes('minimal') ||
    msg.includes('maksimal') ||
    msg.includes('tidak valid') ||
    msg.includes('sudah ada') ||
    msg.includes('sudah terdaftar') ||
    msg.includes('Kuota') ||
    msg.includes('Kode lisensi') ||
    msg.includes('tidak ditemukan');

  if (isKnownInputError) {
    return NextResponse.json(
      { success: false, code: 'BAD_REQUEST', error: msg, message: msg },
      { status: 400 }
    );
  }

  console.error('[API ERROR]', error);
  return NextResponse.json(
    {
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Terjadi kesalahan internal pada server.',
      message: 'Terjadi kesalahan internal pada server.',
    },
    { status: 500 }
  );
}
