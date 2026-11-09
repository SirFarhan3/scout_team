export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Tanpa Keterangan';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  recorded_by: string;
  status: AttendanceStatus;
  created_at: string;
  // Join data
  student?: {
    full_name: string;
    class_name: string;
    group_name: string;
    qr_code_id: string;
  };
  recorder?: {
    full_name: string;
  };
}

export interface RecordAttendanceInput {
  qr_code_id: string;
  recorded_by: string;
  status?: AttendanceStatus;
}