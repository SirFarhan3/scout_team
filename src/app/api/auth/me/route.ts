import { NextResponse } from 'next/server';
import { dbOne } from '@/lib/turso';
import { clearServerSessionCookie, extractBearerTokenFromHeaders } from '@/lib/session';
import { getVerifiedSession, handleApiError } from '@/lib/authServer';

export async function GET(request: Request) {
  try {
    const bearerToken = await extractBearerTokenFromHeaders();
    const isXhrBootstrap =
      request.headers.get('x-requested-with')?.toLowerCase() === 'xmlhttprequest';

    if (!bearerToken && !isXhrBootstrap) {
      return NextResponse.json(
        {
          success: false,
          code: 'MISSING_JWT_TOKEN',
          error: 'Header Authorization Bearer token JWT wajib disertakan.',
          user: null,
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const ctx = await getVerifiedSession({ allowCookieFallback: isXhrBootstrap });
    if (!ctx) {
      await clearServerSessionCookie().catch(() => {});
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', user: null },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let usage: { student_count: number; user_count: number } | null = null;
    if (ctx.school) {
      const [studentRes, userRes] = await Promise.all([
        dbOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?`, [
          ctx.school.id,
        ]),
        dbOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM users WHERE school_id = ?`, [
          ctx.school.id,
        ]),
      ]);
      usage = {
        student_count: Number(studentRes?.cnt) || 0,
        user_count: Number(userRes?.cnt) || 0,
      };
    }

    return NextResponse.json(
      {
        success: true,
        token: ctx.token,
        user: {
          ...ctx.user,
          school: ctx.school,
          usage,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          Authorization: `Bearer ${ctx.token}`,
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
