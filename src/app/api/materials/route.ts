import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbAll, dbOne, escapeSqlLike, parseJsonField } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeLongText, assertSafeText } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

function formatMaterial(row: Record<string, unknown>) {
  return {
    ...row,
    equipment: parseJsonField(row.equipment, []),
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'paginated';

    if (mode === 'categories') {
      const rows = await dbAll<{ category: string }>(
        `SELECT DISTINCT category FROM materials WHERE school_id = ? AND category IS NOT NULL AND category <> ''`,
        [schoolId]
      );
      const uniqueCategories = rows.map((r) => String(r.category)).filter(Boolean);
      return NextResponse.json({
        success: true,
        categories: ['Semua Kategori', ...uniqueCategories],
      });
    }

    if (mode === 'all') {
      const rows = await dbAll<Record<string, unknown>>(
        `SELECT * FROM materials WHERE school_id = ? ORDER BY created_at DESC`,
        [schoolId]
      );
      return NextResponse.json({ success: true, data: rows.map(formatMaterial) });
    }

    const safePage = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize')) || 9));
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'Semua Kategori';
    const from = (safePage - 1) * pageSize;

    const whereParts: string[] = ['school_id = ?'];
    const whereArgs: Array<string | number> = [schoolId];

    if (category && category !== 'Semua Kategori') {
      const safeCategory = assertSafeText(category, 'Kategori', 100);
      whereParts.push('category = ?');
      whereArgs.push(safeCategory);
    }

    const trimmedSearch = assertSafeText(search, 'Kata kunci pencarian', 150);
    if (trimmedSearch) {
      const pattern = `%${escapeSqlLike(trimmedSearch)}%`;
      whereParts.push(`(LOWER(title) LIKE LOWER(?) ESCAPE '\\' OR LOWER(description) LIKE LOWER(?) ESCAPE '\\')`);
      whereArgs.push(pattern, pattern);
    }

    const whereSql = whereParts.join(' AND ');

    const [countRes, rows] = await Promise.all([
      dbOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM materials WHERE ${whereSql}`, whereArgs),
      dbAll<Record<string, unknown>>(
        `SELECT * FROM materials WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...whereArgs, pageSize, from]
      ),
    ]);

    const items = rows.map(formatMaterial);
    const total = Number(countRes?.cnt) || 0;

    return NextResponse.json({
      success: true,
      result: {
        data: items,
        total,
        page: safePage,
        pageSize,
        fromRow: total === 0 ? 0 : from + 1,
        toRow: total === 0 ? 0 : Math.min(from + items.length, total),
      },
    });
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
    if (!body || typeof body !== 'object') throw new ValidationError('Payload tidak valid.');

    const title = assertSafeText(body.title, 'Judul Materi', 200);
    const category = assertSafeText(body.category, 'Kategori Materi', 100);
    const description = assertSafeLongText(body.description, 'Deskripsi Materi', 20000);
    if (!title || !category || !description) {
      throw new ValidationError('Judul, kategori, dan deskripsi materi wajib diisi.');
    }

    const equipment = Array.isArray(body.equipment)
      ? body.equipment.map((rawEq: unknown) => {
          const eq =
            rawEq && typeof rawEq === 'object' ? (rawEq as Record<string, unknown>) : {};
          return {
            name: assertSafeText(eq.name, 'Nama Peralatan', 150),
            isMandatory: Boolean(eq.isMandatory),
          };
        })
      : [];

    const data = await dbOne<Record<string, unknown>>(
      `INSERT INTO materials (id, school_id, title, category, description, equipment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        crypto.randomUUID(),
        schoolId,
        title,
        category,
        description,
        JSON.stringify(equipment),
        new Date().toISOString(),
      ]
    );

    if (!data) throw new Error('Gagal menyimpan materi.');
    return NextResponse.json({ success: true, material: formatMaterial(data) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
