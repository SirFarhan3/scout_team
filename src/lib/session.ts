import 'server-only';
import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { dbExec } from '@/lib/turso';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SignedSessionPayload,
  signSessionToken,
  verifySessionToken,
} from '@/lib/sessionToken';
import type { AllowedRole } from '@/lib/sanitize';

export function hashSessionLookupToken(sessionId: string, userId: string): string {
  const secret = process.env.SESSION_SECRET || '';
  return crypto
    .createHmac('sha256', secret)
    .update(`${sessionId}:${userId}`)
    .digest('hex');
}

function isSecureCookieContext(request?: Request): boolean {
  if (request) {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      return forwardedProto.split(',')[0]?.trim().toLowerCase() === 'https';
    }
    try {
      const url = new URL(request.url);
      if (url.protocol === 'https:') return true;
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false;
    } catch {
      // ignore
    }
  }
  return process.env.NODE_ENV === 'production';
}

export async function createServerSession(params: {
  userId: string;
  schoolId: string | null;
  role: AllowedRole;
  tokenVersion: number;
  ipAddress?: string;
  userAgent?: string;
  request?: Request;
}): Promise<{ sessionId: string; token: string }> {
  const sessionId = crypto.randomUUID();
  const tokenHash = hashSessionLookupToken(sessionId, params.userId);
  const nowIso = new Date().toISOString();
  const expMs = Date.now() + SESSION_TTL_SECONDS * 1000;
  const expiresAtIso = new Date(expMs).toISOString();

  try {
    await dbExec(
      `INSERT INTO user_sessions
         (id, user_id, school_id, token_hash, token_version, ip_address, user_agent, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        params.userId,
        params.schoolId,
        tokenHash,
        params.tokenVersion,
        params.ipAddress || null,
        (params.userAgent || '').slice(0, 255) || null,
        expiresAtIso,
        nowIso,
      ]
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed creating user session:', msg);
    throw new Error('Gagal membuat sesi login yang aman.');
  }

  const payload: SignedSessionPayload = {
    sid: sessionId,
    uid: params.userId,
    role: params.role,
    sch: params.schoolId,
    tv: params.tokenVersion,
    exp: expMs,
  };

  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookieContext(params.request),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return { sessionId, token };
}

export async function extractBearerTokenFromHeaders(): Promise<string | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function readSignedSessionFromHeaders(): Promise<SignedSessionPayload | null> {
  const token = await extractBearerTokenFromHeaders();
  if (!token) return null;
  return verifySessionToken(token);
}

export async function readSignedSessionFromCookies(): Promise<SignedSessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(raw);
}

export async function clearServerSessionCookie(request?: Request): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureCookieContext(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await dbExec(
    `UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), sessionId]
  );
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await dbExec(
    `UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), userId]
  );
}
