import { supabase } from '@/lib/supabase';
import { CreateStudentInput, Student } from '@/types/student';

export const studentService = {
  // Ambil semua data siswa
  async getAllStudents(): Promise<Student[]> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Gagal mengambil data siswa');
    }
    return data || [];
  },

  // Cari siswa berdasarkan QR Code ID (Untuk Scanner)
  async getStudentByQrCode(qrCodeId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('qr_code_id', qrCodeId)
      .single();

    if (error) return null;
    return data;
  },

  // Tambah siswa baru
  async createStudent(studentData: CreateStudentInput): Promise<Student> {
    const { data, error } = await supabase
      .from('students')
      .insert([studentData])
      .select()
      .single();

    if (error) {
      console.error('Error creating student:', error.message);
      throw new Error(error.message);
    }

    return data;
  },
  
  async updateStudent(id: string, studentData: any): Promise<Student> {
    console.log("Student Data: ", studentData)
    console.log("ID: ", id)
    const { data, error } = await supabase
      .from('students')
      .update(studentData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating student:', error.message);
      throw new Error(error.message);
    }

    return data && data.length > 0 ? data[0] : studentData;
  },

  // Hapus siswa berdasarkan ID
  async deleteStudent(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting student:', error.message);
      throw new Error(error.message);
    }

    return true;
  }
};