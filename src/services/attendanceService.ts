import { apiFetch } from '@/lib/apiClient';
import { AttendanceRecord, RecordAttendanceInput } from '@/types/attendance';

export const attendanceService = {
  async recordAttendanceByQr(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    const res = await apiFetch<{ success: true; record: AttendanceRecord }>('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'qr',
        qr_code_id: input.qr_code_id,
        status: input.status || 'Hadir',
      }),
    });
    return res.record;
  },

  async getRecentAttendance(limit = 20): Promise<AttendanceRecord[]> {
    const res = await apiFetch<{ success: true; records: AttendanceRecord[] }>(
      `/api/attendance?mode=recent&limit=${limit}`
    );
    return res.records || [];
  },

  async getUniqueRecentAttendance(limit = 10): Promise<AttendanceRecord[]> {
    const res = await apiFetch<{ success: true; records: AttendanceRecord[] }>(
      `/api/attendance?mode=uniqueRecent&limit=${limit}`
    );
    return res.records || [];
  },

  async getAllStudents() {
    const res = await apiFetch<{ success: true; students: any[] }>('/api/students');
    return res.students || [];
  },

  async recordManualAttendance(input: {
    student_id: string;
    recorded_by?: string;
    status: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir';
  }): Promise<AttendanceRecord> {
    const res = await apiFetch<{ success: true; record: AttendanceRecord }>('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'manual',
        student_id: input.student_id,
        status: input.status,
      }),
    });
    return res.record;
  },

  async recordBatchAttendance(
    records: {
      student_id: string;
      recorded_by?: string;
      status: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir';
    }[]
  ) {
    await apiFetch('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'batch',
        records: records.map((r) => ({ student_id: r.student_id, status: r.status })),
      }),
    });
    return true;
  },

  async getTodayAttendanceRecords() {
    const res = await apiFetch<{ success: true; records: any[] }>('/api/attendance?mode=today');
    return res.records || [];
  },

  async getAttendanceReportForExport() {
    const res = await apiFetch<{ success: true; report: any[] }>('/api/attendance?mode=report');
    return res.report || [];
  },

  async getStudentAttendanceStats(studentId: string): Promise<{
    totalHeldSessions: number;
    studentPresentCount: number;
    attendancePercentage: number;
  }> {
    const res = await apiFetch<{
      success: true;
      stats: {
        totalHeldSessions: number;
        studentPresentCount: number;
        attendancePercentage: number;
      };
    }>(`/api/attendance?mode=studentStats&studentId=${encodeURIComponent(studentId)}`);
    return res.stats;
  },
};
