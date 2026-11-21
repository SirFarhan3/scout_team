import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbAll, dbExec, dbOne, parseJsonField } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

function sanitizeLogEntries(entries: unknown) {
  if (!Array.isArray(entries)) return [];
  return entries.map((rawItem: unknown, idx: number) => {
    const item =
      rawItem && typeof rawItem === 'object' ? (rawItem as Record<string, unknown>) : {};
    return {
      waktu: assertSafeText(item.waktu, `Waktu baris #${idx + 1}`, 60),
      kegiatan: assertSafeText(item.kegiatan, `Kegiatan baris #${idx + 1}`, 1000),
    };
  });
}

export async function GET() {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });

    const rows = await dbAll<Record<string, unknown>>(
      `SELECT * FROM log_books WHERE school_id = ? ORDER BY tanggal DESC`,
      [ctx.school!.id]
    );

    const logs = rows.map((row) => ({
      ...row,
      kegiatan: parseJsonField(row.kegiatan, []),
    }));

    return NextResponse.json({ success: true, logs });
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
    if (!body || typeof body !== 'object') throw new ValidationError('Payload log tidak valid.');

    const safeDate = assertSafeText(body.tanggal, 'Tanggal Log', 30);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate)) {
      throw new ValidationError('Format tanggal harus YYYY-MM-DD.');
    }
    const safeEntries = sanitizeLogEntries(body.entries);
    const serializedEntries = JSON.stringify(safeEntries);
    const mode = body.mode === 'upsert' ? 'upsert' : 'create';
    const nowIso = new Date().toISOString();

    if (mode === 'create') {
      const existing = await dbOne<{ id: string }>(
        `SELECT id FROM log_books WHERE school_id = ? AND tanggal = ? LIMIT 1`,
        [schoolId, safeDate]
      );

      if (existing) {
        throw new ValidationError(
          `Log harian untuk tanggal ${safeDate} sudah ada! Silakan gunakan fitur Edit pada tabel.`
        );
      }

      await dbExec(
        `INSERT INTO log_books (id, school_id, tanggal, kegiatan, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), schoolId, safeDate, serializedEntries, nowIso]
      );
      return NextResponse.json({ success: true }, { status: 201 });
    }

    await dbExec(
      `INSERT INTO log_books (id, school_id, tanggal, kegiatan, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(school_id, tanggal) DO UPDATE SET kegiatan = excluded.kegiatan`,
      [crypto.randomUUID(), schoolId, safeDate, serializedEntries, nowIso]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
