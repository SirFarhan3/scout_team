import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { handleApiError, requireAuth } from '@/lib/authServer';

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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRecords = await dbAll<{ student_id: string; status: string; created_at: string }>(
      `SELECT student_id, status, created_at
       FROM attendance
       WHERE school_id = ? AND created_at >= ?
       ORDER BY created_at DESC`,
      [schoolId, todayStart.toISOString()]
    );

    const latestStatusByStudent = new Map<string, string>();
    for (const record of todayRecords) {
      if (!latestStatusByStudent.has(record.student_id)) {
        latestStatusByStudent.set(record.student_id, record.status);
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
