import crypto from 'crypto';
import { containsDangerousCode } from '@/lib/sanitize';

/**
 * Verifikasi Origin / Referer / Sec-Fetch-* untuk mencegah serangan CSRF
 * pada seluruh endpoint mutasi internal.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return false;
  }

  const fetchMode = request.headers.get('sec-fetch-mode');
  if (fetchMode === 'no-cors') {
    return false;
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return false;

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // Untuk mutasi (POST/PUT/PATCH/DELETE), tolak jika tidak ada Origin maupun Referer
  // kecuali untuk request same-origin browser yang pasti menyertakan Origin/Referer.
  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return false;
  }

  return true;
}

/**
 * Memastikan mutasi datang dari origin yang sama dan bertipe JSON (defense-in-depth anti-CSRF).
 */
export function assertSameOriginMutation(request: Request): void {
  if (!isSameOriginRequest(request)) {
    throw new CsrfError('Akses lintas origin atau permintaan tidak sah ditolak.');
  }
}

export class CsrfError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'CsrfError';
  }
}

/**
 * Perbandingan string rahasia secara constant-time untuk mencegah timing attack.
 */
export function safeCompareSecret(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Sanitasi & batasi panjang input pengguna sebelum masuk ke prompt AI
 * untuk mengurangi risiko Prompt Injection, XSS, dan Token Exhaustion DoS.
 */
export function sanitizePromptField(value: unknown, maxLength = 300): string {
  if (typeof value !== 'string') return '';
  if (containsDangerousCode(value)) {
    throw new Error('Input ditolak karena mengandung tag HTML atau kode JavaScript berbahaya.');
  }
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/```/g, '')
    .trim()
    .slice(0, maxLength);
}
