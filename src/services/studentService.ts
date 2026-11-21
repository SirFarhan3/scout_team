import { apiFetch } from '@/lib/apiClient';
import { CreateStudentInput, Student } from '@/types/student';

export const studentService = {
  async getAllStudents(): Promise<Student[]> {
    const res = await apiFetch<{ success: true; students: Student[] }>('/api/students');
    return res.students || [];
  },

  async getStudentByQrCode(qrCodeId: string): Promise<Student | null> {
    const res = await apiFetch<{ success: true; student: Student | null }>(
      `/api/students?qr=${encodeURIComponent(qrCodeId)}`
    );
    return res.student || null;
  },

  async createStudent(studentData: CreateStudentInput): Promise<Student> {
    const res = await apiFetch<{ success: true; student: Student }>('/api/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
    return res.student;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    const res = await apiFetch<{ success: true; student: Student }>(
      `/api/students/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    return res.student;
  },

  async deleteStudent(id: string): Promise<void> {
    await apiFetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
