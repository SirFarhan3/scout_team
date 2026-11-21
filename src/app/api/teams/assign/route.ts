import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertValidUuid } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const body = await request.json().catch(() => null);
    const studentId = assertValidUuid(body?.studentId, 'ID Siswa');
    const teamId = body?.teamId ? assertValidUuid(body.teamId, 'ID Regu') : null;

    if (teamId) {
      const team = await dbOne<{ id: string }>(
        `SELECT id FROM teams WHERE id = ? AND school_id = ? LIMIT 1`,
        [teamId, schoolId]
      );

      if (!team) {
        throw new ValidationError('Regu tujuan tidak ditemukan pada sekolah Anda.');
      }
    }

    const updated = await dbAll<{ id: string }>(
      `UPDATE students SET team_id = ? WHERE id = ? AND school_id = ? RETURNING id`,
      [teamId, studentId, schoolId]
    );

    if (updated.length === 0) {
      throw new ValidationError('Siswa tidak ditemukan pada sekolah Anda.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
