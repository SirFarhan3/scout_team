import type { AllowedRole } from '@/lib/sanitize';

export const SESSION_COOKIE_NAME = 'scout_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari

export interface SignedSessionPayload {
  sid: string; // session row id di DB user_sessions
  uid: string; // user id
  role: AllowedRole;
  sch: string | null; // school_id (null khusus superadmin)
  tv: number; // token_version
  exp: number; // epoch ms
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function getSecretKeyMaterial(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'Konfigurasi keamanan belum lengkap: SESSION_SECRET wajib diatur minimal 32 karakter.'
    );
  }
  return secret;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSecretKeyMaterial();
  const enc = new TextEncoder();
  return globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionToken(payload: SignedSessionPayload): Promise<string> {
  const enc = new TextEncoder();
  const headerB64 = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getHmacKey();
  const sigBuffer = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  const sigB64 = toBase64Url(new Uint8Array(sigBuffer));
  return `${signingInput}.${sigB64}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SignedSessionPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 && parts.length !== 2) return null;

  let signingInput: string;
  let payloadB64: string;
  let sigB64: string;

  if (parts.length === 3) {
    const [headerB64, pB64, sB64] = parts;
    if (!headerB64 || !pB64 || !sB64) return null;
    signingInput = `${headerB64}.${pB64}`;
    payloadB64 = pB64;
    sigB64 = sB64;
  } else {
    const [pB64, sB64] = parts;
    if (!pB64 || !sB64) return null;
    signingInput = pB64;
    payloadB64 = pB64;
    sigB64 = sB64;
  }

  try {
    const sigBytes = fromBase64Url(sigB64);
    const payloadBytes = fromBase64Url(payloadB64);
    if (!sigBytes || !payloadBytes) return null;

    const key = await getHmacKey();
    const enc = new TextEncoder();
    const sigBuffer = new Uint8Array(sigBytes).buffer;
    const isValid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      enc.encode(signingInput)
    );
    if (!isValid) return null;

    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as SignedSessionPayload;
    if (
      !parsed ||
      typeof parsed.sid !== 'string' ||
      typeof parsed.uid !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.tv !== 'number' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }

    if (parsed.exp <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
