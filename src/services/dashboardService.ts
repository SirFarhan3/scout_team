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

    // 3. Hitung presensi 'Hadir' hari ini
    const { count: hadirCount, error: hadirErr } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'Hadir');

    if (hadirErr) console.error('Error fetching hadir count:', hadirErr);

    // 4. Hitung presensi 'Izin' atau 'Sakit' hari ini
    const { count: izinSakitCount, error: izinErr } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())
      .in('status', ['Izin', 'Sakit']);

    if (izinErr) console.error('Error fetching izin/sakit count:', izinErr);

    const total = totalStudents || 0;
    const hadir = hadirCount || 0;
    const izinSakit = izinSakitCount || 0;

    // 5. Hitung sisa anggota yang belum absen (Belum Absen)
    const belumAbsen = Math.max(0, total - (hadir + izinSakit));

    return {
      hadirToday: hadir,
      izinSakitToday: izinSakit,
      belumAbsenToday: belumAbsen,
    };
  },
};