const JWT_STORAGE_KEY = 'scout_jwt_token';
let inMemoryJwtToken: string | null = null;
let bootstrapPromise: Promise<string | null> | null = null;

export function getJwtToken(): string | null {
  if (inMemoryJwtToken) return inMemoryJwtToken;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(JWT_STORAGE_KEY);
    if (stored) {
      inMemoryJwtToken = stored;
      return stored;
    }
  }
  return null;
}

export function setJwtToken(token: string | null | undefined): void {
  if (!token) return;
  inMemoryJwtToken = token;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(JWT_STORAGE_KEY, token);
  }
}

export function clearJwtToken(): void {
  inMemoryJwtToken = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(JWT_STORAGE_KEY);
    window.localStorage.removeItem('scout_session');
  }
}

async function ensureJwtToken(url: string): Promise<string | null> {
  const existing = getJwtToken();
  if (existing) return existing;

  // Jangan bootstrap pada endpoint auth publik / me / logout
  if (
    typeof window === 'undefined' ||
    url.startsWith('/api/auth/login') ||
    url.startsWith('/api/auth/register') ||
    url.startsWith('/api/auth/logout') ||
    url.startsWith('/api/auth/me')
  ) {
    return null;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        if (data?.token && typeof data.token === 'string') {
          setJwtToken(data.token);
          return data.token as string;
        }
        return null;
      } catch {
        return null;
      } finally {
        bootstrapPromise = null;
      }
    })();
  }

  return bootstrapPromise;
}

export class SubscriptionRequiredError extends Error {
  code = 'SUBSCRIPTION_REQUIRED';
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionRequiredError';
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }

  const jwtToken = await ensureJwtToken(url);
  if (jwtToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${jwtToken}`);
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
  });

  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    throw new Error('Respons server tidak valid.');
  }

  if (data?.token && typeof data.token === 'string') {
    setJwtToken(data.token);
  }

  const errText =
    typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
      ? data.message
      : undefined;

  if (res.status === 401) {
    clearJwtToken();
    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login' &&
      window.location.pathname !== '/register'
    ) {
      window.location.href = '/login';
    }
    throw new Error(errText || 'Sesi Anda telah berakhir. Silakan login kembali.');
  }

  if (res.status === 402 || data?.code === 'SUBSCRIPTION_REQUIRED') {
    const msg =
      errText ||
      'Langganan sekolah belum aktif atau telah berakhir. Silakan aktivasi di menu Langganan.';
    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/billing' &&
      window.location.pathname !== '/superadmin'
    ) {
      window.location.href = '/billing';
    }
    throw new SubscriptionRequiredError(msg);
  }

  if (!res.ok || data?.success === false) {
    throw new Error(errText || `Permintaan gagal (${res.status}).`);
  }

  return data as T;
}
