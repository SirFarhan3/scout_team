import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

export async function GET() {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });

    const teams = await dbAll<Record<string, unknown>>(
      `SELECT id, name, gender, created_at
       FROM teams
       WHERE school_id = ?
       ORDER BY name COLLATE NOCASE ASC`,
      [ctx.school!.id]
    );

    return NextResponse.json({ success: true, teams });
  } catch (error) {
    return handleApiError(error);
  }
}

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
    const trimmedName = assertSafeText(body?.name, 'Nama Regu', 100);
    if (!trimmedName) throw new ValidationError('Nama regu wajib diisi.');
    const safeGender = body?.gender
      ? assertSafeText(body.gender, 'Gender Regu', 30)
      : 'Campuran';

    const dup = await dbOne<{ id: string }>(
      `SELECT id FROM teams WHERE school_id = ? AND LOWER(name) = LOWER(?) LIMIT 1`,
      [schoolId, trimmedName]
    );

    if (dup) {
      throw new ValidationError(`Regu "${trimmedName}" sudah ada di sekolah Anda.`);
    }

    const team = await dbOne<Record<string, unknown>>(
      `INSERT INTO teams (id, school_id, name, gender, created_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, name, gender, created_at`,
      [crypto.randomUUID(), schoolId, trimmedName, safeGender, new Date().toISOString()]
    );

    if (!team) throw new Error('Gagal membuat regu baru.');
    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
