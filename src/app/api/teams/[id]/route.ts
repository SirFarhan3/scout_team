import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText, assertValidUuid } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const { id } = await context.params;
    const teamId = assertValidUuid(id, 'ID Regu');

    const body = await request.json().catch(() => null);
    const setClauses: string[] = [];
    const args: Array<string | null> = [];

    if (body?.name !== undefined) {
      const name = assertSafeText(body.name, 'Nama Regu', 100);
      if (!name) throw new ValidationError('Nama regu wajib diisi.');
      setClauses.push('name = ?');
      args.push(name);
    }
    if (body?.gender !== undefined) {
      setClauses.push('gender = ?');
      args.push(body.gender ? assertSafeText(body.gender, 'Gender Regu', 30) : null);
    }

    if (setClauses.length === 0) {
      throw new ValidationError('Tidak ada data yang diperbarui.');
    }

    args.push(teamId, schoolId);

    const data = await dbOne<Record<string, unknown>>(
      `UPDATE teams
       SET ${setClauses.join(', ')}
       WHERE id = ? AND school_id = ?
       RETURNING id, name, gender, created_at`,
      args
    );

    if (!data) throw new ValidationError('Regu tidak ditemukan pada sekolah Anda.');

    return NextResponse.json({ success: true, team: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const { id } = await context.params;
    const teamId = assertValidUuid(id, 'ID Regu');

    const deleted = await dbAll<{ id: string }>(
      `DELETE FROM teams WHERE id = ? AND school_id = ? RETURNING id`,
      [teamId, schoolId]
    );

    if (deleted.length === 0) {
      throw new ValidationError('Regu tidak ditemukan pada sekolah Anda.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
