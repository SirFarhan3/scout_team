import crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { InStatement } from '@libsql/client';
import { dbAll, dbExec, dbOne, getDb } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText, assertValidUuid, extractQrCodeId, isValidUuid } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';

const VALID_STATUSES = ['Hadir', 'Izin', 'Sakit', 'Tidak Hadir', 'Tanpa Keterangan'] as const;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function getTodayIsoRange() {
  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);
  const dateStr = nowWib.toISOString().slice(0, 10);

  const startOfDay = new Date(`${dateStr}T00:00:00.000+07:00`).toISOString();
  const endOfDay = new Date(`${dateStr}T23:59:59.999+07:00`).toISOString();
  return { startOfDay, endOfDay };
}

function formatAttendanceRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    student_id: String(row.student_id),
    recorded_by: row.recorded_by ? String(row.recorded_by) : null,
    status: String(row.status),
    created_at: String(row.created_at),
    student: row._s_full_name
      ? {
          full_name: String(row._s_full_name),
          class_name: row._s_class_name ? String(row._s_class_name) : null,
          qr_code_id: row._s_qr_code_id ? String(row._s_qr_code_id) : null,
          team_id: row._s_team_id ? String(row._s_team_id) : null,
          team: row._t_name ? { name: String(row._t_name) } : null,
          group_name: row._t_name ? String(row._t_name) : '-',
        }
      : null,
  };
}

async function fetchJoinedAttendanceById(
  schoolId: string,
  attendanceId: string
): Promise<ReturnType<typeof formatAttendanceRow> | null> {
  const row = await dbOne<Record<string, unknown>>(
    `SELECT a.id, a.student_id, a.recorded_by, a.status, a.created_at,
            s.full_name AS _s_full_name, s.class_name AS _s_class_name,
            s.qr_code_id AS _s_qr_code_id, s.team_id AS _s_team_id,
            t.name AS _t_name
     FROM attendance a
     LEFT JOIN students s ON s.id = a.student_id AND s.school_id = a.school_id
     LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = a.school_id
     WHERE a.id = ? AND a.school_id = ?
     LIMIT 1`,
    [attendanceId, schoolId]
  );
  return row ? formatAttendanceRow(row) : null;
}

function toLocalDateKey(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const wib = new Date(d.getTime() + WIB_OFFSET_MS);
  return wib.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'recent';
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    if (mode === 'recent') {
      const rows = await dbAll<Record<string, unknown>>(
        `SELECT a.id, a.student_id, a.recorded_by, a.status, a.created_at,
                s.full_name AS _s_full_name, s.class_name AS _s_class_name,
                s.qr_code_id AS _s_qr_code_id, s.team_id AS _s_team_id,
                t.name AS _t_name
         FROM attendance a
         LEFT JOIN students s ON s.id = a.student_id AND s.school_id = a.school_id
         LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = a.school_id
         WHERE a.school_id = ?
         ORDER BY a.created_at DESC
         LIMIT ?`,
        [schoolId, limit * 3]
      );
      // Distinct per siswa pada hari yang sama
      const distinctPerDayMap = new Map<string, ReturnType<typeof formatAttendanceRow>>();
      for (const item of rows) {
        const formatted = formatAttendanceRow(item);
        const dayKey = `${formatted.student_id}:${toLocalDateKey(formatted.created_at)}`;
        if (!distinctPerDayMap.has(dayKey)) {
          distinctPerDayMap.set(dayKey, formatted);
        }
      }
      return NextResponse.json({
        success: true,
        records: Array.from(distinctPerDayMap.values()).slice(0, limit),
      });
    }

    if (mode === 'uniqueRecent') {
      const rows = await dbAll<Record<string, unknown>>(
        `SELECT a.id, a.student_id, a.recorded_by, a.status, a.created_at,
                s.full_name AS _s_full_name, s.class_name AS _s_class_name,
                s.qr_code_id AS _s_qr_code_id, s.team_id AS _s_team_id,
                t.name AS _t_name
         FROM attendance a
         LEFT JOIN students s ON s.id = a.student_id AND s.school_id = a.school_id
         LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = a.school_id
         WHERE a.school_id = ?
         ORDER BY a.created_at DESC
         LIMIT 60`,
        [schoolId]
      );
      const uniqueMap = new Map();
      for (const item of rows) {
        const formatted = formatAttendanceRow(item);
        if (!uniqueMap.has(formatted.student_id)) {
          uniqueMap.set(formatted.student_id, formatted);
        }
      }
      return NextResponse.json({
        success: true,
        records: Array.from(uniqueMap.values()).slice(0, limit),
      });
    }

    if (mode === 'today') {
      const { startOfDay, endOfDay } = getTodayIsoRange();
      const rows = await dbAll<{ student_id: string; status: string; created_at: string }>(
        `SELECT student_id, status, created_at
         FROM attendance
         WHERE school_id = ? AND created_at >= ? AND created_at <= ?
         ORDER BY created_at DESC`,
        [schoolId, startOfDay, endOfDay]
      );
      // Distinct per student_id untuk hari tersebut
      const distinctTodayMap = new Map<string, { student_id: string; status: string; created_at: string }>();
      for (const row of rows) {
        const sid = String(row.student_id);
        if (!distinctTodayMap.has(sid)) {
          distinctTodayMap.set(sid, row);
        }
      }
      return NextResponse.json({
        success: true,
        records: Array.from(distinctTodayMap.values()),
      });
    }

    if (mode === 'report') {
      const [students, allAttendance] = await Promise.all([
        dbAll<{
          id: string;
          full_name: string;
          class_name: string | null;
          team_id: string | null;
          team_name: string | null;
          nta: string | null;
        }>(
          `SELECT s.id, s.full_name, s.class_name, s.team_id, t.name AS team_name, s.nta
           FROM students s
           LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = s.school_id
           WHERE s.school_id = ?
           ORDER BY s.full_name COLLATE NOCASE ASC`,
          [schoolId]
        ),
        dbAll<{ student_id: string; status: string; created_at: string }>(
          `SELECT student_id, status, created_at FROM attendance WHERE school_id = ?`,
          [schoolId]
        ),
      ]);

      const attendanceByStudent = new Map<
        string,
        Array<{ status: string; created_at: string }>
      >();
      for (const att of allAttendance) {
        const sid = String(att.student_id);
        const list = attendanceByStudent.get(sid) || [];
        list.push(att);
        attendanceByStudent.set(sid, list);
      }

      const isSaturdaySession = (isoString?: string): boolean => {
        if (!isoString) return false;
        const d = new Date(isoString);
        return !Number.isNaN(d.getTime()) && d.getDay() === 6;
      };

      const saturdayHeldDates = new Set<string>();
      for (const student of students) {
        for (const att of attendanceByStudent.get(String(student.id)) || []) {
          if (att.created_at && isSaturdaySession(att.created_at)) {
            const dateKey = toLocalDateKey(att.created_at);
            if (dateKey) saturdayHeldDates.add(dateKey);
          }
        }
      }
      const totalSaturdaySessions = saturdayHeldDates.size;

      const report = students.map((student, index) => {
        const attendanceList = attendanceByStudent.get(String(student.id)) || [];
        const teamName = student.team_name || '-';

        const dailyStatusMap = new Map<string, string>();
        for (const att of attendanceList) {
          const dateKey = toLocalDateKey(att.created_at);
          if (!dateKey) continue;

          const currentStatus = att.status || 'Tidak Hadir';
          const existingStatus = dailyStatusMap.get(dateKey);

          if (!existingStatus) {
            dailyStatusMap.set(dateKey, currentStatus);
          } else if (currentStatus === 'Hadir') {
            dailyStatusMap.set(dateKey, 'Hadir');
          } else if (currentStatus === 'Izin' && existingStatus === 'Tidak Hadir') {
            dailyStatusMap.set(dateKey, 'Izin');
          } else if (currentStatus === 'Sakit' && existingStatus === 'Tidak Hadir') {
            dailyStatusMap.set(dateKey, 'Sakit');
          }
        }

        let totalHadir = 0;
        let totalIzin = 0;
        let totalSakit = 0;
        let totalAlpha = 0;

        dailyStatusMap.forEach((status) => {
          if (status === 'Hadir') totalHadir += 1;
          else if (status === 'Izin') totalIzin += 1;
          else if (status === 'Sakit') totalSakit += 1;
          else if (status === 'Tidak Hadir' || status === 'Tanpa Keterangan') totalAlpha += 1;
        });

        let attendancePercentage = 0;
        if (totalSaturdaySessions > 0) {
          attendancePercentage = Math.round((totalHadir / totalSaturdaySessions) * 10000) / 100;
        } else if (totalHadir > 0) {
          attendancePercentage = 100;
        }

        let predikat = 'D';
        let keterangan = 'Kurang Aktif Saat Mengikuti Kegiatan';
        if (attendancePercentage >= 85) {
          predikat = 'A';
          keterangan = 'Sangat Aktif Saat Mengikuti Kegiatan';
        } else if (attendancePercentage >= 75) {
          predikat = 'B';
          keterangan = 'Baik Saat Mengikuti Kegiatan';
        } else if (attendancePercentage >= 60) {
          predikat = 'C';
          keterangan = 'Cukup Saat Mengikuti Kegiatan';
        }

        return {
          id: student.id,
          No: index + 1,
          'Nama Lengkap': student.full_name || '-',
          Kelas: student.class_name || '-',
          Regu: teamName,
          NTA: student.nta || '-',
          'Total Hadir': totalHadir,
          'Total Izin': totalIzin,
          'Total Sakit': totalSakit,
          'Total Tidak Hadir': totalAlpha,
          'Total Pertemuan': totalSaturdaySessions,
          Persentase: `${attendancePercentage}%`,
          'Persentase Angka': attendancePercentage,
          'Predikat Nilai': predikat,
          Keterangan: keterangan,
        };
      });

      return NextResponse.json({ success: true, report });
    }

    if (mode === 'studentStats') {
      const studentId = assertValidUuid(searchParams.get('studentId'), 'ID Siswa');

      const studentCheck = await dbOne<{ id: string }>(
        `SELECT id FROM students WHERE id = ? AND school_id = ? LIMIT 1`,
        [studentId, schoolId]
      );

      if (!studentCheck) {
        throw new ValidationError('Siswa tidak ditemukan pada sekolah Anda.');
      }

      const [allSessions, studentRecords] = await Promise.all([
        dbAll<{ created_at: string }>(
          `SELECT created_at FROM attendance WHERE school_id = ?`,
          [schoolId]
        ),
        dbAll<{ created_at: string }>(
          `SELECT created_at FROM attendance WHERE school_id = ? AND student_id = ? AND status = 'Hadir'`,
          [schoolId, studentId]
        ),
      ]);

      const uniqueHeldDates = new Set<string>();
      for (const session of allSessions) {
        if (session.created_at) {
          const d = new Date(session.created_at);
          if (!Number.isNaN(d.getTime()) && d.getDay() === 6) {
            const key = toLocalDateKey(session.created_at);
            if (key) uniqueHeldDates.add(key);
          }
        }
      }
      const totalHeldSessions = uniqueHeldDates.size;

      const uniqueStudentPresentDates = new Set<string>();
      for (const rec of studentRecords) {
        const key = toLocalDateKey(rec.created_at);
        if (key) uniqueStudentPresentDates.add(key);
      }
      const studentPresentCount = uniqueStudentPresentDates.size;

      let attendancePercentage = 0;
      if (totalHeldSessions > 0) {
        attendancePercentage = Math.round((studentPresentCount / totalHeldSessions) * 10000) / 100;
      } else if (studentPresentCount > 0) {
        attendancePercentage = 100;
      }

      return NextResponse.json({
        success: true,
        stats: { totalHeldSessions, studentPresentCount, attendancePercentage },
      });
    }

    throw new ValidationError('Mode query presensi tidak valid.');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina', 'instruktur'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const recordedBy = ctx.user.id; // Selalu dari session server!

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload presensi tidak valid.');
    }

    const mode = body.mode || 'qr';

    if (mode === 'qr') {
      const extractedQr = extractQrCodeId(body.qr_code_id || '');
      const scanned = assertSafeText(extractedQr, 'QR Code ID', 120);
      if (!scanned) throw new ValidationError('QR Code kosong / tidak terbaca.');

      let student = await dbOne<{ id: string }>(
        `SELECT id FROM students WHERE school_id = ? AND LOWER(qr_code_id) = LOWER(?) LIMIT 1`,
        [schoolId, scanned]
      );

      if (!student && isValidUuid(scanned)) {
        student = await dbOne<{ id: string }>(
          `SELECT id FROM students WHERE school_id = ? AND id = ? LIMIT 1`,
          [schoolId, scanned]
        );
      }

      if (!student) {
        throw new ValidationError(
          `QR Code Anggota tidak valid atau bukan milik sekolah Anda! (terbaca: "${scanned}")`
        );
      }

      const studentId = String(student.id);
      const { startOfDay, endOfDay } = getTodayIsoRange();
      const existingRows = await dbAll<{ id: string; status: string }>(
        `SELECT id, status
         FROM attendance
         WHERE school_id = ? AND student_id = ? AND created_at >= ? AND created_at <= ?
         ORDER BY created_at ASC`,
        [schoolId, studentId, startOfDay, endOfDay]
      );

      if (existingRows.length > 0) {
        const primary = existingRows[0];
        // Jika sempat ada duplikat di hari yang sama, bersihkan sisanya agar tetap 1 baris per siswa per hari
        if (existingRows.length > 1) {
          const duplicateIds = existingRows.slice(1).map((r) => String(r.id));
          const dupPlaceholders = duplicateIds.map(() => '?').join(', ');
          await dbExec(
            `DELETE FROM attendance WHERE school_id = ? AND id IN (${dupPlaceholders})`,
            [schoolId, ...duplicateIds]
          );
        }

        const existingRecord = await fetchJoinedAttendanceById(schoolId, String(primary.id));
        if (existingRecord) {
          return NextResponse.json({
            success: true,
            record: { ...existingRecord, alreadyRecorded: true },
          });
        }
      }

      const status = VALID_STATUSES.includes(body.status) ? body.status : 'Hadir';
      const newAttendanceId = crypto.randomUUID();
      await dbExec(
        `INSERT INTO attendance (id, school_id, student_id, recorded_by, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newAttendanceId, schoolId, studentId, recordedBy, status, new Date().toISOString()]
      );

      const createdRecord = await fetchJoinedAttendanceById(schoolId, newAttendanceId);
      return NextResponse.json({
        success: true,
        record: { ...createdRecord, alreadyRecorded: false },
      });
    }

    if (mode === 'manual') {
      const studentId = assertValidUuid(body.student_id, 'ID Siswa');
      const status = body.status;
      if (!VALID_STATUSES.includes(status)) {
        throw new ValidationError('Status presensi tidak valid.');
      }

      const st = await dbOne<{ id: string }>(
        `SELECT id FROM students WHERE id = ? AND school_id = ? LIMIT 1`,
        [studentId, schoolId]
      );

      if (!st) {
        throw new ValidationError('Siswa tidak ditemukan pada sekolah Anda.');
      }

      const { startOfDay, endOfDay } = getTodayIsoRange();
      const existingRows = await dbAll<{ id: string; status: string }>(
        `SELECT id, status
         FROM attendance
         WHERE school_id = ? AND student_id = ? AND created_at >= ? AND created_at <= ?
         ORDER BY created_at ASC`,
        [schoolId, studentId, startOfDay, endOfDay]
      );

      if (existingRows.length > 0) {
        const primary = existingRows[0];
        if (existingRows.length > 1) {
          const duplicateIds = existingRows.slice(1).map((r) => String(r.id));
          const dupPlaceholders = duplicateIds.map(() => '?').join(', ');
          await dbExec(
            `DELETE FROM attendance WHERE school_id = ? AND id IN (${dupPlaceholders})`,
            [schoolId, ...duplicateIds]
          );
        }

        if (primary.status !== status) {
          await dbExec(
            `UPDATE attendance SET status = ?, recorded_by = ? WHERE id = ? AND school_id = ?`,
            [status, recordedBy, String(primary.id), schoolId]
          );
        }

        const existingRecord = await fetchJoinedAttendanceById(schoolId, String(primary.id));
        return NextResponse.json({
          success: true,
          record: existingRecord ? { ...existingRecord, alreadyRecorded: primary.status === status } : null,
        });
      }

      const newAttendanceId = crypto.randomUUID();
      await dbExec(
        `INSERT INTO attendance (id, school_id, student_id, recorded_by, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newAttendanceId, schoolId, studentId, recordedBy, status, new Date().toISOString()]
      );

      const record = await fetchJoinedAttendanceById(schoolId, newAttendanceId);
      return NextResponse.json({ success: true, record });
    }

    if (mode === 'batch') {
      const records = Array.isArray(body.records) ? body.records : [];
      if (records.length === 0 || records.length > 500) {
        throw new ValidationError('Jumlah data presensi massal harus antara 1 sampai 500 siswa.');
      }

      const sanitizedMap = new Map<string, { student_id: string; status: string }>();
      for (const rawRec of records) {
        const rec =
          rawRec && typeof rawRec === 'object' ? (rawRec as Record<string, unknown>) : {};
        const sid = assertValidUuid(rec.student_id, 'ID Siswa');
        const st = typeof rec.status === 'string' ? rec.status : '';
        if (!VALID_STATUSES.includes(st as (typeof VALID_STATUSES)[number])) {
          throw new ValidationError('Status presensi massal tidak valid.');
        }
        sanitizedMap.set(sid, { student_id: sid, status: st });
      }
      const sanitized = Array.from(sanitizedMap.values());

      const studentIds = sanitized.map((r) => r.student_id);
      const placeholders = studentIds.map(() => '?').join(', ');

      const ownedStudents = await dbAll<{ id: string }>(
        `SELECT id FROM students WHERE school_id = ? AND id IN (${placeholders})`,
        [schoolId, ...studentIds]
      );

      if (ownedStudents.length !== studentIds.length) {
        throw new ValidationError('Sebagian siswa tidak terdaftar di sekolah Anda.');
      }

      const { startOfDay, endOfDay } = getTodayIsoRange();
      const todayExisting = await dbAll<{ id: string; student_id: string; status: string }>(
        `SELECT id, student_id, status
         FROM attendance
         WHERE school_id = ? AND student_id IN (${placeholders}) AND created_at >= ? AND created_at <= ?
         ORDER BY created_at ASC`,
        [schoolId, ...studentIds, startOfDay, endOfDay]
      );

      const existingMap = new Map<string, { id: string; status: string }>();
      const duplicateIdsToDelete: string[] = [];
      for (const row of todayExisting) {
        const sid = String(row.student_id);
        if (!existingMap.has(sid)) {
          existingMap.set(sid, { id: String(row.id), status: String(row.status) });
        } else {
          duplicateIdsToDelete.push(String(row.id));
        }
      }

      const statements: InStatement[] = [];
      const nowIso = new Date().toISOString();

      if (duplicateIdsToDelete.length > 0) {
        const dupPlaceholders = duplicateIdsToDelete.map(() => '?').join(', ');
        statements.push({
          sql: `DELETE FROM attendance WHERE school_id = ? AND id IN (${dupPlaceholders})`,
          args: [schoolId, ...duplicateIdsToDelete],
        });
      }

      for (const item of sanitized) {
        const existing = existingMap.get(item.student_id);
        if (existing) {
          // Data sudah ada di hari tersebut: jangan di-insert lagi (hanya update bila status berubah)
          if (existing.status !== item.status) {
            statements.push({
              sql: `UPDATE attendance SET status = ?, recorded_by = ? WHERE id = ? AND school_id = ?`,
              args: [item.status, recordedBy, existing.id, schoolId],
            });
          }
        } else {
          statements.push({
            sql: `INSERT INTO attendance (id, school_id, student_id, recorded_by, status, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              crypto.randomUUID(),
              schoolId,
              item.student_id,
              recordedBy,
              item.status,
              nowIso,
            ],
          });
        }
      }

      if (statements.length > 0) {
        const db = await getDb();
        await db.batch(statements, 'write');
      }

      return NextResponse.json({ success: true });
    }

    throw new ValidationError('Mode presensi tidak valid.');
  } catch (error) {
    return handleApiError(error);
  }
}
