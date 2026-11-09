export interface Student {
  id: string;
  full_name: string;
  group_name: string;
  class_name?: string;
  nta?: string;
  qr_code_id: string;
  created_at?: string;
}

// Tipe khusus untuk payload insert/form
export type CreateStudentInput = Omit<Student, 'id' | 'qr_code_id' | 'created_at'>;