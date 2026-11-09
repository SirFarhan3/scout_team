import { supabase } from '@/lib/supabase';
import { AttendanceRecord, RecordAttendanceInput } from '@/types/attendance';

export const attendanceService = {
  // 🎯 Record Presensi berdasarkan QR Code ID
  async recordAttendanceByQr(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    // 1. Cari student berdasarkan qr_code_id
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, full_name, class_name, group_name')
      .eq('qr_code_id', input.qr_code_id)
      .single();

    if (studentErr || !student) {
      throw new Error('QR Code Anggota tidak valid / tidak ditemukan!');
    }

    // 2. Simpan presensi
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
};