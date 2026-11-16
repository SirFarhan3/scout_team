import { supabase } from '@/lib/supabase';

export const dashboardService = {
  async getDashboardStats() {
    // 1. Hitung total siswa terdaftar
    const { count: totalStudents, error: studentErr } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    if (studentErr) console.error('Error fetching students count:', studentErr);

    // 2. Ambil awal hari ini (00:00:00)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 3. Ambil seluruh presensi hari ini (terbaru lebih dulu)
    const { data: todayRecords, error: attendanceErr } = await supabase
      .from('attendance')
      .select('student_id, status, created_at')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    if (attendanceErr) console.error('Error fetching today attendance:', attendanceErr);

    // 4. Distinct per anggota: tiap anggota hanya dihitung 1x,
    //    memakai status presensi terbarunya hari ini
    const latestStatusByStudent = new Map<string, string>();
    for (const record of todayRecords || []) {
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

    const total = totalStudents || 0;

    // 5. Sisa anggota yang belum absen
    const belumAbsen = Math.max(0, total - (hadir + izinSakit));

    return {
      hadirToday: hadir,
      izinSakitToday: izinSakit,
      belumAbsenToday: belumAbsen,
    };
  },
};
