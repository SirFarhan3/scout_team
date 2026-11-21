import { NextResponse } from 'next/server';
import { dbAll, dbOne, parseJsonField } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertValidUuid } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { sanitizeProkerPayload } from '@/lib/domainHelpers';

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
    const { id } = await context.params;
    const prokerId = assertValidUuid(id, 'ID Program Kerja');

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ValidationError('Payload tidak valid.');
    const payload = sanitizeProkerPayload(body);

    const data = await dbOne<Record<string, unknown>>(
      `UPDATE program_kerja
       SET tahun_ajaran = ?, golongan = ?, nama_pangkalan = ?, kegiatan = ?
       WHERE id = ? AND school_id = ?
       RETURNING *`,
      [
        payload.tahun_ajaran,
        payload.golongan,
        payload.nama_pangkalan,
        JSON.stringify(payload.kegiatan),
        prokerId,
        ctx.school!.id,
      ]
    );

    if (!data) throw new ValidationError('Program kerja tidak ditemukan pada sekolah Anda.');
    return NextResponse.json({
      success: true,
      proker: {
        ...data,
        kegiatan: parseJsonField(data.kegiatan, []),
      },
    });
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
    const { id } = await context.params;
    const prokerId = assertValidUuid(id, 'ID Program Kerja');

    const deleted = await dbAll<{ id: string }>(
      `DELETE FROM program_kerja WHERE id = ? AND school_id = ? RETURNING id`,
      [prokerId, ctx.school!.id]
    );

    if (deleted.length === 0) {
      throw new ValidationError('Program kerja tidak ditemukan pada sekolah Anda.');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
