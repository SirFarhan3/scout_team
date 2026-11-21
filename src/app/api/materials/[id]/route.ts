import { NextResponse } from 'next/server';
import { dbAll, dbOne, parseJsonField } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeLongText, assertSafeText, assertValidUuid } from '@/lib/sanitize';
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
    const materialId = assertValidUuid(id, 'ID Materi');

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ValidationError('Payload tidak valid.');

    const setClauses: string[] = [];
    const args: Array<string> = [];

    if (body.title !== undefined) {
      setClauses.push('title = ?');
      args.push(assertSafeText(body.title, 'Judul Materi', 200));
    }
    if (body.category !== undefined) {
      setClauses.push('category = ?');
      args.push(assertSafeText(body.category, 'Kategori Materi', 100));
    }
    if (body.description !== undefined) {
      setClauses.push('description = ?');
      args.push(assertSafeLongText(body.description, 'Deskripsi Materi', 20000));
    }
    if (Array.isArray(body.equipment)) {
      const cleanEq = body.equipment.map((rawEq: unknown) => {
        const eq =
          rawEq && typeof rawEq === 'object' ? (rawEq as Record<string, unknown>) : {};
        return {
          name: assertSafeText(eq.name, 'Nama Peralatan', 150),
          isMandatory: Boolean(eq.isMandatory),
        };
      });
      setClauses.push('equipment = ?');
      args.push(JSON.stringify(cleanEq));
    }

    if (setClauses.length === 0) {
      throw new ValidationError('Tidak ada data materi yang diperbarui.');
    }

    args.push(materialId, schoolId);

    const data = await dbOne<Record<string, unknown>>(
      `UPDATE materials SET ${setClauses.join(', ')} WHERE id = ? AND school_id = ? RETURNING *`,
      args
    );

    if (!data) throw new ValidationError('Materi tidak ditemukan pada sekolah Anda.');
    return NextResponse.json({
      success: true,
      material: {
        ...data,
        equipment: parseJsonField(data.equipment, []),
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
    const schoolId = ctx.school!.id;
    const { id } = await context.params;
    const materialId = assertValidUuid(id, 'ID Materi');

    const deleted = await dbAll<{ id: string }>(
      `DELETE FROM materials WHERE id = ? AND school_id = ? RETURNING id`,
      [materialId, schoolId]
    );

    if (deleted.length === 0) {
      throw new ValidationError('Materi tidak ditemukan pada sekolah Anda.');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
