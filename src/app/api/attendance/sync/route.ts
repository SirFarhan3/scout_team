import crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { InStatement } from '@libsql/client';
import { dbAll, getDb } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { extractQrCodeId, isValidUuid } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

const VALID_STATUSES = ['Hadir', 'Izin', 'Sakit', 'Tidak Hadir', 'Tanpa Keterangan'] as const;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_SYNC_BATCH = 500;
const MAX_PAST_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

interface IncomingSyncItem {
  client_id?: string;
  student_id?: string;
  qr_code_id?: string;
  status?: string;
  scanned_at?: string;
}

function toWibDateKey(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const wib = new Date(d.getTime() + WIB_OFFSET_MS);
  return wib.toISOString().slice(0, 10);
}

function normalizeScannedAt(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const now = Date.now();
      const ts = parsed.getTime();
      if (ts >= now - MAX_PAST_MS && ts <= now + MAX_FUTURE_MS) {
        return parsed.toISOString();
      }
    }
  }
  return new Date().toISOString();
}

/**
 * POST /api/attendance/sync
 * Menerima batch presensi offline dari IndexedDB, menyimpannya secara idempoten
 * dengan timestamp asli (`scanned_at`) ke `created_at` serta mengisi `synced_at`.
 */
export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);

    const ctx = await requireAuth({
      roles: ['admin', 'pembina', 'instruktur'],
      requireSchool: true,
      requireActiveSubscription: true,
    });

    const schoolId = ctx.school!.id;
    const recordedBy = ctx.user.id;

    const body = await request.json().catch(() => null);
    const rawItems: IncomingSyncItem[] = Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json({
        success: true,
        syncedIds: [],
        skippedIds: [],
        rejectedIds: [],
        syncedCount: 0,
        skippedCount: 0,
      });
    }

    if (rawItems.length > MAX_SYNC_BATCH) {
      throw new ValidationError(
        `Maksimal ${MAX_SYNC_BATCH} data presensi per batch sinkronisasi.`
      );
    }

    // Muat semua siswa milik sekolah ini dalam 1 query agar lookup student_id / qr_code_id cepat & terisolasi
    const schoolStudents = await dbAll<{ id: string; qr_code_id: string }>(
      `SELECT id, qr_code_id FROM students WHERE school_id = ?`,
      [schoolId]
    );

    const studentById = new Map<string, string>();
    const studentByQrLower = new Map<string, string>();
    for (const s of schoolStudents) {
      const sid = String(s.id);
      studentById.set(sid, sid);
      if (s.qr_code_id) {
        studentByQrLower.set(String(s.qr_code_id).trim().toLowerCase(), sid);
      }
    }

    const syncedIds: string[] = [];
    const skippedIds: string[] = [];
    const rejectedIds: string[] = [];

    interface ResolvedItem {
      clientId: string;
      studentId: string;
      status: string;
      scannedAt: string;
      dateKey: string;
    }

    const resolvedItems: ResolvedItem[] = [];
    const batchDayDedupe = new Set<string>();
    const clientIdsInBatch: string[] = [];
    let minIso = '';
    let maxIso = '';

    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue;

      const rawClientId = typeof raw.client_id === 'string' ? raw.client_id.trim() : '';
      const clientId = isValidUuid(rawClientId) ? rawClientId : crypto.randomUUID();

      let resolvedStudentId: string | undefined;
      if (typeof raw.student_id === 'string' && studentById.has(raw.student_id.trim())) {
        resolvedStudentId = studentById.get(raw.student_id.trim());
      } else if (typeof raw.qr_code_id === 'string' && raw.qr_code_id.trim()) {
        const extracted = extractQrCodeId(raw.qr_code_id).trim().toLowerCase();
        resolvedStudentId =
          studentByQrLower.get(extracted) ||
          (isValidUuid(extracted) ? studentById.get(extracted) : undefined);
      }

      if (!resolvedStudentId) {
        if (rawClientId) rejectedIds.push(rawClientId);
        continue;
      }

      const status =
        typeof raw.status === 'string' &&
        VALID_STATUSES.includes(raw.status as (typeof VALID_STATUSES)[number])
          ? raw.status
          : 'Hadir';

      const scannedAt = normalizeScannedAt(raw.scanned_at);
      const dateKey = toWibDateKey(scannedAt);
      const dedupeKey = `${resolvedStudentId}:${dateKey}`;

      // Cegah duplikat dalam 1 batch yang sama untuk siswa & hari yang sama
      if (batchDayDedupe.has(dedupeKey)) {
        skippedIds.push(clientId);
        continue;
      }
      batchDayDedupe.add(dedupeKey);

      resolvedItems.push({
        clientId,
        studentId: resolvedStudentId,
        status,
        scannedAt,
        dateKey,
      });
      clientIdsInBatch.push(clientId);

      const dayStart = new Date(`${dateKey}T00:00:00.000+07:00`).toISOString();
      const dayEnd = new Date(`${dateKey}T23:59:59.999+07:00`).toISOString();
      if (!minIso || dayStart < minIso) minIso = dayStart;
      if (!maxIso || dayEnd > maxIso) maxIso = dayEnd;
    }

    if (resolvedItems.length === 0) {
      return NextResponse.json({
        success: true,
        syncedIds,
        skippedIds,
        rejectedIds,
        syncedCount: 0,
        skippedCount: skippedIds.length,
      });
    }

    // Cek presensi yang sudah ada di DB dalam rentang tanggal batch (anti-duplikat per siswa per hari + client_id)
    const uniqueStudentIds = Array.from(new Set(resolvedItems.map((i) => i.studentId)));
    const studentPlaceholders = uniqueStudentIds.map(() => '?').join(', ');
    const clientPlaceholders = clientIdsInBatch.map(() => '?').join(', ');

    const [existingByDay, existingById] = await Promise.all([
      dbAll<{ student_id: string; created_at: string }>(
        `SELECT student_id, created_at
         FROM attendance
         WHERE school_id = ?
           AND student_id IN (${studentPlaceholders})
           AND created_at >= ?
           AND created_at <= ?`,
        [schoolId, ...uniqueStudentIds, minIso, maxIso]
      ),
      dbAll<{ id: string }>(
        `SELECT id
         FROM attendance
         WHERE school_id = ? AND id IN (${clientPlaceholders})`,
        [schoolId, ...clientIdsInBatch]
      ),
    ]);

    const existingIdSet = new Set(existingById.map((r) => String(r.id)));
    const existingStudentDaySet = new Set<string>();
    for (const row of existingByDay) {
      const dk = toWibDateKey(String(row.created_at));
      if (dk) {
        existingStudentDaySet.add(`${String(row.student_id)}:${dk}`);
      }
    }

    const nowIso = new Date().toISOString();
    const statements: InStatement[] = [];

    for (const item of resolvedItems) {
      const dayKey = `${item.studentId}:${item.dateKey}`;
      if (existingIdSet.has(item.clientId) || existingStudentDaySet.has(dayKey)) {
        skippedIds.push(item.clientId);
        continue;
      }

      existingStudentDaySet.add(dayKey);
      statements.push({
        sql: `INSERT OR IGNORE INTO attendance (id, school_id, student_id, recorded_by, status, created_at, synced_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          item.clientId,
          schoolId,
          item.studentId,
          recordedBy,
          item.status,
          item.scannedAt,
          nowIso,
        ],
      });
      syncedIds.push(item.clientId);
    }

    if (statements.length > 0) {
      const db = await getDb();
      await db.batch(statements, 'write');
    }

    return NextResponse.json({
      success: true,
      syncedIds,
      skippedIds,
      rejectedIds,
      syncedCount: syncedIds.length,
      skippedCount: skippedIds.length,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
