import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbAll, dbOne, parseJsonField } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { handleApiError, requireAuth, ValidationError } from '@/lib/authServer';
import { sanitizeProkerPayload } from '@/lib/domainHelpers';

function formatProker(row: Record<string, unknown>) {
  return {
    ...row,
    kegiatan: parseJsonField(row.kegiatan, []),
  };
}

export async function GET() {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });

    const rows = await dbAll<Record<string, unknown>>(
      `SELECT * FROM program_kerja WHERE school_id = ? ORDER BY created_at DESC`,
      [ctx.school!.id]
    );

    return NextResponse.json({ success: true, prokers: rows.map(formatProker) });
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ValidationError('Payload tidak valid.');

    const payload = sanitizeProkerPayload(body);

    const data = await dbOne<Record<string, unknown>>(
      `INSERT INTO program_kerja (id, school_id, tahun_ajaran, golongan, nama_pangkalan, kegiatan, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        crypto.randomUUID(),
        ctx.school!.id,
        payload.tahun_ajaran,
        payload.golongan,
        payload.nama_pangkalan,
        JSON.stringify(payload.kegiatan),
        new Date().toISOString(),
      ]
    );

    if (!data) throw new Error('Gagal menyimpan program kerja.');
    return NextResponse.json({ success: true, proker: formatProker(data) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
