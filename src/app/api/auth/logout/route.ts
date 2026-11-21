import { NextResponse } from 'next/server';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import {
  clearServerSessionCookie,
  readSignedSessionFromCookies,
  readSignedSessionFromHeaders,
  revokeSessionById,
} from '@/lib/session';
import { handleApiError } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);

    const signed =
      (await readSignedSessionFromHeaders().catch(() => null)) ||
      (await readSignedSessionFromCookies().catch(() => null));
    if (signed) {
      await revokeSessionById(signed.sid).catch(() => {});
      await logSecurityEvent({
        schoolId: signed.sch,
        userId: signed.uid,
        action: 'LOGOUT',
        ipAddress: getClientIp(request),
      });
    }

    await clearServerSessionCookie(request);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
