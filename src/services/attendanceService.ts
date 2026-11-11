import { supabase } from '@/lib/supabase';
import { AttendanceRecord, RecordAttendanceInput } from '@/types/attendance';

export const attendanceService = {
  // 🎯 Record Presensi berdasarkan QR Code ID
  async recordAttendanceByQr(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, full_name, class_name, group_name')
      .eq('qr_code_id', input.qr_code_id)
      .single();

    if (studentErr || !student) {
      throw new Error('QR Code Anggota tidak valid / tidak ditemukan!');
    }

    const { data, error } = await supabase
      .from('attendance')
      .insert({
        student_id: student.id,
        recorded_by: input.recorded_by,
        status: input.status || 'Hadir',
      })
      .select(`
        id,
        student_id,
        recorded_by,
        status,
        created_at,
        student:students(full_name, class_name, group_name, qr_code_id)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as any;
  },

  // 📜 Ambil semua riwayat presensi
  async getRecentAttendance(limit = 20): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
        student_id,
        recorded_by,
        status,
        created_at,
        student:students(full_name, class_name, group_name, qr_code_id)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data as any) || [];
  },

  // 👥 Ambil daftar seluruh siswa
  async getAllStudents() {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, class_name, group_name, qr_code_id')
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // 📝 Catat presensi manual satuan
  async recordManualAttendance(input: {
    student_id: string;
    recorded_by: string;
    status: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir';
  }): Promise<AttendanceRecord> {
    const { data, error } = await supabase
      .from('attendance')
      .insert({
        student_id: input.student_id,
        recorded_by: input.recorded_by,
        status: input.status,
      })
      .select(`
        id,
        student_id,
        recorded_by,
        status,
        created_at,
        student:students(full_name, class_name, group_name, qr_code_id)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as any;
  },
  
  // 📦 Catat presensi massal per kelas (Batch dengan pencegahan duplikat hari ini)
  async recordBatchAttendance(records: { student_id: string; recorded_by: string; status: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir' }[]) {
    const today = new Date().toISOString().split('T')[0];
    
    // Untuk setiap record yang mau disimpan, kita cek apakah siswa ini sudah punya absensi hari ini
    for (const record of records) {
      // 1. Cek apakah sudah ada record absensi untuk student_id ini pada hari ini
      const { data: existing } = await supabase
        .from('attendance')
        .select('id, created_at')
        .eq('student_id', record.student_id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .maybeSingle();

      if (existing) {
        // 2. Kalau sudah ada, kita UPDATE statusnya berdasarkan ID record yang sudah ada
        const { error: updateErr } = await supabase
          .from('attendance')
          .update({ 
            status: record.status,
            recorded_by: record.recorded_by 
          })
          .eq('id', existing.id);

        if (updateErr) throw new Error(updateErr.message);
      } else {
        // 3. Kalau belum ada, baru kita INSERT data baru
        const { error: insertErr } = await supabase
          .from('attendance')
          .insert(record);

        if (insertErr) throw new Error(insertErr.message);
      }
    }

    return true;
  },

  // 📅 Ambil data presensi hari ini (Untuk cek siapa saja yang sudah scan/absen)
  async getTodayAttendanceRecords() {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, status, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (error) throw new Error(error.message);
    return data || [];
  },
  // 📜 Ambil riwayat presensi unik (1 siswa hanya muncul 1 entri terbaru, untuk dashboard & scan)
  async getUniqueRecentAttendance(limit = 10): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
        student_id,
        recorded_by,
        status,
        created_at,
        student:students(full_name, class_name, group_name, qr_code_id)
      `)
      .order('created_at', { ascending: false })
      .limit(50); // Tarik agak banyak untuk disaring unik di frontend

    if (error) throw new Error(error.message);
    
    // Filter unik berdasarkan student_id (ambil yang paling atas/terbaru)
    const uniqueMap = new Map();
    for (const item of (data as any) || []) {
      if (!uniqueMap.has(item.student_id)) {
        uniqueMap.set(item.student_id, item);
      }
    }

    return Array.from(uniqueMap.values()).slice(0, limit);
  },

  // 🌟 Fungsi untuk Report & Export Nilai Berdasarkan Kehadiran
  async getAttendanceReportForExport() {
    // 1. Ambil data siswa beserta seluruh riwayat absensinya menggunakan join
    const { data: students, error: studentErr } = await supabase
      .from('students')
      .select(`
        id,
        full_name,
        class_name,
        group_name,
        nta,
        attendance (
          status
        )
      `);
    if (studentErr) {
      throw new Error(`Gagal memuat rekap laporan: ${studentErr.message}`);
    }
    // 2. Petakan dan kalkulasi jumlah kehadiran per siswa
    const report = students.map((student: any, index: number) => {
      const attendanceList = student.attendance || [];
      
      const totalHadir = attendanceList.filter((a: any) => a.status === 'Hadir').length;
      const totalIzin = attendanceList.filter((a: any) => a.status === 'Izin').length;
      const totalSakit = attendanceList.filter((a: any) => a.status === 'Sakit').length;
      const totalAlpha = attendanceList.filter((a: any) => a.status === 'Tidak Hadir').length;
      // Aturan konversi nilai / predikat berdasarkan jumlah hadir
      let predikat = '';
      let keterangan = 'Kurang / Perlu Pembinaan';
      if (totalHadir >= 20) {
        predikat = 'A';
        keterangan = 'Aktif Saat Mengikuti Kegiatan';
      } else if (totalHadir >= 15) {
        predikat = 'B';
        keterangan = 'Baik Saat Mengikuti Kegiatan';
      } else if (totalHadir >= 10) {
        predikat = 'C';
        keterangan = 'Cukup Saat Mengikuti Kegiatan';
      }else if (totalHadir < 10) {
        predikat = 'D';
        keterangan = 'Kurang Aktif Saat Mengikuti Kegiatan';
      }
      
      return {
        No: index + 1,
        'Nama Lengkap': student.full_name || '-',
        Kelas: student.class_name || '-',
        Regu: student.group_name || '-',
        NTA: student.nta || '-',
        'Total Hadir': totalHadir,
        'Total Izin': totalIzin,
        'Total Sakit': totalSakit,
        'Total Tidak Hadir': totalAlpha,
        'Predikat Nilai': predikat,
        Keterangan: keterangan,
      };
    });
    return report;
  },
};