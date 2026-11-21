import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { handleApiError, requireAuth } from '@/lib/authServer';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function getTodayWibRange() {
  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);
  const dateStr = nowWib.toISOString().slice(0, 10);
  const startOfDay = new Date(`${dateStr}T00:00:00.000+07:00`).toISOString();
  const endOfDay = new Date(`${dateStr}T23:59:59.999+07:00`).toISOString();
  return { startOfDay, endOfDay };
}

export async function GET() {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const studentRes = await dbOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?`,
      [schoolId]
    );

    const { startOfDay, endOfDay } = getTodayWibRange();

    // Ambil data presensi hari ini secara DISTINCT per student_id (ambil status terbaru hari ini)
    const todayRecords = await dbAll<{ student_id: string; status: string; created_at: string }>(
      `SELECT a.student_id, a.status, a.created_at
       FROM attendance a
       INNER JOIN students s ON s.id = a.student_id AND s.school_id = a.school_id
       WHERE a.school_id = ? AND a.created_at >= ? AND a.created_at <= ?
       ORDER BY a.created_at DESC`,
      [schoolId, startOfDay, endOfDay]
    );

    const latestStatusByStudent = new Map<string, string>();
    for (const record of todayRecords) {
      const sid = String(record.student_id);
      if (!latestStatusByStudent.has(sid)) {
        latestStatusByStudent.set(sid, String(record.status));
      }
    }

    let hadir = 0;
    let izinSakit = 0;
    latestStatusByStudent.forEach((status) => {
      if (status === 'Hadir') hadir += 1;
      else if (status === 'Izin' || status === 'Sakit') izinSakit += 1;
    });

    const total = Number(studentRes?.cnt) || 0;
    const belumAbsen = Math.max(0, total - (hadir + izinSakit));

    return NextResponse.json({
      success: true,
      stats: {
        hadirToday: hadir,
        izinSakitToday: izinSakit,
        belumAbsenToday: belumAbsen,
        totalStudents: total,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
