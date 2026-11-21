import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/sessionToken';

const PUBLIC_PATHS = ['/login', '/register'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isHttps =
    forwardedProto === 'https' || request.nextUrl.protocol === 'https:';

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (isHttps) {
    cspDirectives.push('upgrade-insecure-requests');
  }
  const cspHeaderValue = cspDirectives.join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeaderValue);

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionCookie);

  // 1. Jika user belum terautentikasi dan mengakses halaman terproteksi -> redirect ke /login
  if (!session && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    const res = NextResponse.redirect(loginUrl);
    res.headers.set('Content-Security-Policy', cspHeaderValue);
    return res;
  }

  // 2. Jika sudah login dan membuka /login atau /register -> arahkan sesuai role
  if (session && isPublicPath(pathname)) {
    const target = session.role === 'superadmin' ? '/superadmin' : '/';
    const res = NextResponse.redirect(new URL(target, request.url));
    res.headers.set('Content-Security-Policy', cspHeaderValue);
    return res;
  }

  // 3. Isolasi Superadmin vs Tenant Sekolah
  if (session) {
    if (session.role === 'superadmin' && pathname !== '/superadmin' && !pathname.startsWith('/superadmin/')) {
      const res = NextResponse.redirect(new URL('/superadmin', request.url));
      res.headers.set('Content-Security-Policy', cspHeaderValue);
      return res;
    }

    if (session.role !== 'superadmin' && (pathname === '/superadmin' || pathname.startsWith('/superadmin/'))) {
      const res = NextResponse.redirect(new URL('/', request.url));
      res.headers.set('Content-Security-Policy', cspHeaderValue);
      return res;
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', cspHeaderValue);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
