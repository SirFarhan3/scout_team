import { supabase } from '@/lib/supabase';
import { AttendanceRecord, RecordAttendanceInput } from '@/types/attendance';
import { assertSafeText } from '@/lib/sanitize';

// Helper range waktu lokal hari ini (00:00:00 s/d 23:59:59.999) dalam UTC ISO
function getTodayIsoRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const startOfDay = new Date(`${dateStr}T00:00:00`).toISOString();
  const endOfDay = new Date(`${dateStr}T23:59:59.999`).toISOString();

  return { startOfDay, endOfDay };
}

// Helper normalisasi data student agar tetap punya properti group_name dari relasi team:teams(name)
function normalizeAttendanceRecord(record: any): AttendanceRecord {
  if (!record) return record;
  if (record.student) {
    const teamObj = Array.isArray(record.student.team) ? record.student.team[0] : record.student.team;
    record.student.group_name = record.student.group_name || teamObj?.name || '-';
  }
  return record as AttendanceRecord;
}

export const attendanceService = {
  // 🎯 Record Presensi berdasarkan QR Code ID
  async recordAttendanceByQr(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    const scanned = assertSafeText(input.qr_code_id || '', 'QR Code ID', 120);
    if (!scanned) {
      throw new Error('QR Code kosong / tidak terbaca.');
    }

    const columns = 'id, full_name, class_name, team_id, team:teams(name)';

    // 1) Cocokkan dengan qr_code_id (tidak sensitif huruf besar/kecil, pakai limit(1)
    //    agar tidak gagal jika ada data ganda seperti pada .single())
    let student: { id: string; full_name: string; class_name: string; group_name?: string; team?: any } | null = null;
    let lookupError: string | null = null;

    const byQr = await supabase
      .from('students')
      .select(columns)
      .ilike('qr_code_id', scanned.replace(/[%_]/g, '\\$&'))
      .limit(1);

    if (byQr.error) lookupError = byQr.error.message;
    else if (byQr.data && byQr.data.length > 0) student = byQr.data[0] as any;

    // 2) Fallback: QR lama yang dicetak berisi id siswa (UUID)
    if (!student && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scanned)) {
      const byId = await supabase.from('students').select(columns).eq('id', scanned).limit(1);
      if (byId.error) lookupError = byId.error.message;
      else if (byId.data && byId.data.length > 0) student = byId.data[0] as any;
    }

    if (!student) {
      throw new Error(
        lookupError
          ? `Gagal mencari anggota: ${lookupError}`
          : `QR Code Anggota tidak valid / tidak ditemukan! (terbaca: "${scanned}")`
      );
    }

    // 3) 🛡️ PENJAGAAN DUPLIKASI HARI INI:
    // Cek apakah siswa ini sudah memiliki absensi pada hari ini
    const { startOfDay, endOfDay } = getTodayIsoRange();

    const { data: existingRecords, error: checkErr } = await supabase
      .from('attendance')
      .select(`
        id,
        student_id,
        recorded_by,
        status,
        created_at,
        student:students(full_name, class_name, qr_code_id, team_id, team:teams(name))
      `)
      .eq('student_id', student.id)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkErr) {
      console.warn('Gagal cek presensi hari ini:', checkErr.message);
    }

    if (existingRecords && existingRecords.length > 0) {
      const existing = normalizeAttendanceRecord(existingRecords[0]);

      // Jika siswa sudah berstatus 'Hadir' hari ini, JANGAN INSERT LAGI ke database
      if (existing.status === 'Hadir') {
        return {
          ...existing,
          alreadyRecorded: true,
        };
      }

      // Jika statusnya sebelumnya selain 'Hadir' (misal: 'Tidak Hadir'/'Izin' dari absen pagi),
      // update status record hari ini menjadi 'Hadir' tanpa menambah baris duplikat
      const { data: updated, error: updateErr } = await supabase
        .from('attendance')
        .update({
          status: 'Hadir',
          recorded_by: input.recorded_by,
        })
        .eq('id', existing.id)
        .select(`
          id,
          student_id,
          recorded_by,
          status,
          created_at,
          student:students(full_name, class_name, qr_code_id, team_id, team:teams(name))
        `)
        .single();

      if (!updateErr && updated) {
        return {
          ...normalizeAttendanceRecord(updated),
          alreadyRecorded: false,
        };
      }
    }

    // 4) Jika belum pernah absen hari ini, insert data baru
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
        student:students(full_name, class_name, qr_code_id, team_id, team:teams(name))
      `)
      .single();

    if (error) throw new Error(error.message);
    return {
      ...normalizeAttendanceRecord(data),
      alreadyRecorded: false,
    };
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
        student:students(full_name, class_name, qr_code_id, team_id, team:teams(name))
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return ((data as any) || []).map(normalizeAttendanceRecord);
  },

  // 👥 Ambil daftar seluruh siswa
  async getAllStudents() {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, class_name, qr_code_id, team_id, team:teams(name)')
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map((s: any) => {
      const teamObj = Array.isArray(s.team) ? s.team[0] : s.team;
      return {
        ...s,
        group_name: s.group_name || teamObj?.name || '-',
      };
    });
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
        student:students(full_name, class_name, qr_code_id, team_id, team:teams(name))
      `)
      .single();

    if (error) throw new Error(error.message);
    return normalizeAttendanceRecord(data);
  },
  
  // 📦 Catat presensi massal per kelas (Batch dengan pencegahan duplikat hari ini)
  async recordBatchAttendance(records: { student_id: string; recorded_by: string; status: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir' }[]) {
    const { startOfDay, endOfDay } = getTodayIsoRange();
    
    // Untuk setiap record yang mau disimpan, kita cek apakah siswa ini sudah punya absensi hari ini
    for (const record of records) {
      // 1. Cek apakah sudah ada record absensi untuk student_id ini pada hari ini
      const { data: existing } = await supabase
        .from('attendance')
        .select('id, created_at')
        .eq('student_id', record.student_id)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .limit(1);

      if (existing && existing.length > 0) {
        // 2. Kalau sudah ada, kita UPDATE statusnya berdasarkan ID record yang sudah ada
        const { error: updateErr } = await supabase
          .from('attendance')
          .update({ 
            status: record.status,
            recorded_by: record.recorded_by 
          })
          .eq('id', existing[0].id);

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
    const { startOfDay, endOfDay } = getTodayIsoRange();
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, status, created_at')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

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
        student:students(full_name, class_name, qr_code_id, team_id, team:teams(name))
      `)
      .order('created_at', { ascending: false })
      .limit(50); // Tarik agak banyak untuk disaring unik di frontend

    if (error) throw new Error(error.message);
    
    // Filter unik berdasarkan student_id (ambil yang paling atas/terbaru)
    const uniqueMap = new Map();
    for (const item of (data as any) || []) {
      if (!uniqueMap.has(item.student_id)) {
        uniqueMap.set(item.student_id, normalizeAttendanceRecord(item));
      }
    }

    return Array.from(uniqueMap.values()).slice(0, limit);
  },

  // 🌟 Fungsi untuk Report & Export Nilai Berdasarkan Kehadiran (Dengan Penjagaan Distinct Per Hari)
  async getAttendanceReportForExport() {
    // 1. Ambil data siswa beserta seluruh riwayat absensinya menggunakan join
    const { data: students, error: studentErr } = await supabase
      .from('students')
      .select(`
        id,
        full_name,
        class_name,
        team_id,
        team:teams(name),
        nta,
        attendance (
          status,
          created_at
        )
      `)
      .order('full_name', { ascending: true });

    if (studentErr) {
      throw new Error(`Gagal memuat rekap laporan: ${studentErr.message}`);
    }

    // Helper konversi timestamp ke tanggal lokal 'YYYY-MM-DD'
    const toLocalDateKey = (isoString?: string) => {
      if (!isoString) return '';
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Helper pengecekan hari Sabtu (6 = Sabtu dalam JavaScript Date.getDay())
    const isSaturdaySession = (isoString?: string): boolean => {
      if (!isoString) return false;
      const d = new Date(isoString);
      return !isNaN(d.getTime()) && d.getDay() === 6;
    };

    // 2. Kumpulkan seluruh tanggal unik pelaksanaan pertemuan HANYA pada HARI SABTU (Acuan Latihan Wajib)
    const saturdayHeldDates = new Set<string>();
    for (const student of students || []) {
      for (const att of student.attendance || []) {
        if (att.created_at && isSaturdaySession(att.created_at)) {
          const dateKey = toLocalDateKey(att.created_at);
          if (dateKey) saturdayHeldDates.add(dateKey);
        }
      }
    }
    const totalSaturdaySessions = saturdayHeldDates.size;

    // 3. Petakan dan kalkulasi jumlah kehadiran per siswa:
    //    - Kehadiran siswa dihitung dari SELURUH hari (Sabtu + Minggu + hari lain)
    //    - Acuan pembagi persentase adalah total sesi Hari Sabtu
    const report = (students || []).map((student: any, index: number) => {
      const attendanceList = student.attendance || [];
      const teamObj = Array.isArray(student.team) ? student.team[0] : student.team;
      const teamName = student.group_name || teamObj?.name || '-';

      // 🛡️ Filter DISTINCT per tanggal untuk kehadiran siswa (Sabtu + Hari Lain):
      const dailyStatusMap = new Map<string, string>();

      for (const att of attendanceList) {
        const dateKey = toLocalDateKey(att.created_at);
        if (!dateKey) continue;

        const currentStatus = att.status || 'Tidak Hadir';
        const existingStatus = dailyStatusMap.get(dateKey);

        if (!existingStatus) {
          dailyStatusMap.set(dateKey, currentStatus);
        } else if (currentStatus === 'Hadir') {
          // 'Hadir' memiliki prioritas tertinggi jika ada status ganda di hari yang sama
          dailyStatusMap.set(dateKey, 'Hadir');
        } else if (currentStatus === 'Izin' && existingStatus === 'Tidak Hadir') {
          dailyStatusMap.set(dateKey, 'Izin');
        } else if (currentStatus === 'Sakit' && existingStatus === 'Tidak Hadir') {
          dailyStatusMap.set(dateKey, 'Sakit');
        }
      }

      // Hitung total kehadiran dari seluruh hari yang distinct (Sabtu + Hari Lain)
      let totalHadir = 0;
      let totalIzin = 0;
      let totalSakit = 0;
      let totalAlpha = 0;

      dailyStatusMap.forEach((status) => {
        if (status === 'Hadir') totalHadir++;
        else if (status === 'Izin') totalIzin++;
        else if (status === 'Sakit') totalSakit++;
        else if (status === 'Tidak Hadir' || status === 'Tanpa Keterangan') totalAlpha++;
      });

      // Hitung persentase kehadiran dinamis terhadap acuan hari Sabtu:
      // Sangat memungkinkan persentase > 100% (misal 30 hadir / 25 sesi Sabtu = 120%)
      let attendancePercentage = 0;
      if (totalSaturdaySessions > 0) {
        attendancePercentage = Math.round((totalHadir / totalSaturdaySessions) * 10000) / 100;
      } else if (totalHadir > 0) {
        attendancePercentage = 100;
      }

      // Aturan konversi nilai / predikat berdasarkan persentase kehadiran
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
      } else {
        predikat = 'D';
        keterangan = 'Kurang Aktif Saat Mengikuti Kegiatan';
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

    return report;
  },

  // 📊 Hitung Persentase Kehadiran Siswa Secara Dinamis (Tanpa Tabel Jadwal)
  async getStudentAttendanceStats(studentId: string): Promise<{
    totalHeldSessions: number;
    studentPresentCount: number;
    attendancePercentage: number;
  }> {
    if (!studentId?.trim()) {
      throw new Error('studentId wajib diisi.');
    }

    // Helper konversi ISO UTC timestamp ke format tanggal lokal (YYYY-MM-DD)
    const toLocalDateString = (isoString: string): string => {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 1. Query semua created_at untuk mengetahui riwayat seluruh sesi yang pernah berjalan
    const { data: allSessions, error: allSessionsError } = await supabase
      .from('attendance')
      .select('created_at');

    if (allSessionsError) {
      throw new Error(`Gagal mengambil data seluruh sesi: ${allSessionsError.message}`);
    }

    // 2. Ekstrak tanggal unik (YYYY-MM-DD) sebagai total pertemuan yang benar-benar terlaksana PADA HARI SABTU
    const uniqueHeldDates = new Set<string>();
    for (const session of allSessions || []) {
      if (session.created_at) {
        const d = new Date(session.created_at);
        if (!isNaN(d.getTime()) && d.getDay() === 6) {
          const dateKey = toLocalDateString(session.created_at);
          if (dateKey) uniqueHeldDates.add(dateKey);
        }
      }
    }
    const totalHeldSessions = uniqueHeldDates.size;

    // 3. Query riwayat absensi siswa yang bersangkutan dengan status 'Hadir'
    const { data: studentRecords, error: studentError } = await supabase
      .from('attendance')
      .select('created_at')
      .eq('student_id', studentId)
      .eq('status', 'Hadir');

    if (studentError) {
      throw new Error(`Gagal mengambil data absensi siswa: ${studentError.message}`);
    }

    // Ekstrak tanggal unik kehadiran siswa dari SELURUH hari (Sabtu + Minggu + hari lain)
    const uniqueStudentPresentDates = new Set<string>();
    for (const record of studentRecords || []) {
      if (record.created_at) {
        const dateKey = toLocalDateString(record.created_at);
        if (dateKey) uniqueStudentPresentDates.add(dateKey);
      }
    }
    const studentPresentCount = uniqueStudentPresentDates.size;

    // 4. Hitung persentase kehadiran terhadap total sesi hari Sabtu (bisa > 100% jika ada latihan hari lain)
    let attendancePercentage = 0;
    if (totalHeldSessions > 0) {
      const rawPercentage = (studentPresentCount / totalHeldSessions) * 100;
      attendancePercentage = Math.round(rawPercentage * 100) / 100; // Dibulatkan 2 angka di belakang koma
    } else if (studentPresentCount > 0) {
      attendancePercentage = 100;
    }

    // 5. Kembalikan hasil
    return {
      totalHeldSessions,
      studentPresentCount,
      attendancePercentage,
    };
  },
};