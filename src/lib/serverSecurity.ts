import crypto from 'crypto';

/**
 * Verifikasi Origin / Sec-Fetch-Site untuk mencegah serangan CSRF (Cross-Site Request Forgery)
 * pada endpoint mutasi / AI internal.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return false;
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

  if (!origin) {
    // Jika Origin header tidak ada pada browser POST, tolak apabila Sec-Fetch-Mode = cors/no-cors lintas situs
    const fetchMode = request.headers.get('sec-fetch-mode');
    if (fetchMode === 'no-cors') return false;
    return true;
  }

  if (!host) return false;

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
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
 * untuk mengurangi risiko Prompt Injection dan Token Exhaustion DoS.
 */
export function sanitizePromptField(value: unknown, maxLength = 300): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/```/g, '')
    .trim()
    .slice(0, maxLength);
}
