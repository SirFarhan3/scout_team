import { supabase } from '@/lib/supabase';
import { CreateStudentInput, Student } from '@/types/student';
import { assertSafeText } from '@/lib/sanitize';

// Helper untuk menormalisasi data siswa dari relasi team:teams(id, name, gender)
function normalizeStudent(s: any): Student {
  if (!s) return s;
  const teamObj = Array.isArray(s.team) ? s.team[0] : s.team;
  return {
    ...s,
    group_name: s.group_name || teamObj?.name || '-',
  };
}

// Helper untuk mencari atau membuat team berdasarkan nama regu (group_name)
async function resolveTeamIdByName(groupName?: string): Promise<string | null> {
  const trimmed = assertSafeText(groupName || '', 'Nama Regu', 100);
  if (!trimmed || trimmed === '-') return null;

  // 1. Cek apakah regu sudah ada di tabel teams
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .ilike('name', trimmed.replace(/[%_]/g, '\\$&'))
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  // 2. Jika belum ada, buat regu baru di tabel teams
  const { data: created, error } = await supabase
    .from('teams')
    .insert({ name: trimmed })
    .select('id')
    .single();

  if (!error && created) {
    return created.id;
  }

  return null;
}

export const studentService = {
  // Ambil semua data siswa beserta relasi nama regu dari tabel teams
  async getAllStudents(): Promise<Student[]> {
    const { data, error } = await supabase
      .from('students')
      .select('*, team:teams(id, name, gender)')
      .order('full_name', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Gagal mengambil data siswa');
    }
    return (data || []).map(normalizeStudent);
  },

  // Cari siswa berdasarkan QR Code ID (Untuk Scanner)
  async getStudentByQrCode(qrCodeId: string): Promise<Student | null> {
    const safeQr = assertSafeText(qrCodeId, 'QR Code ID', 120);
    const { data, error } = await supabase
      .from('students')
      .select('*, team:teams(id, name, gender)')
      .eq('qr_code_id', safeQr)
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return normalizeStudent(data[0]);
  },

  // Tambah siswa baru (otomatis hubungkan ke team_id berdasarkan group_name)
  async createStudent(studentData: CreateStudentInput): Promise<Student> {
    const { group_name, ...rest } = studentData as any;

    const safeFullName = assertSafeText(rest.full_name, 'Nama Lengkap', 120);
    const safeClassName = assertSafeText(rest.class_name, 'Kelas', 50);
    const safeNta = rest.nta ? assertSafeText(rest.nta, 'NTA', 60) : null;
    const safeQrId = rest.qr_code_id ? assertSafeText(rest.qr_code_id, 'QR Code ID', 120) : undefined;

    if (!safeFullName || !safeClassName) {
      throw new Error('Nama lengkap dan kelas wajib diisi.');
    }

    const teamId = await resolveTeamIdByName(group_name);

    const payload: any = {
      ...rest,
      full_name: safeFullName,
      class_name: safeClassName,
      ...(safeNta !== null ? { nta: safeNta } : {}),
      ...(safeQrId ? { qr_code_id: safeQrId } : {}),
      ...(teamId ? { team_id: teamId } : {}),
    };

    const { data, error } = await supabase
      .from('students')
      .insert([payload])
      .select('*, team:teams(id, name, gender)')
      .single();

    if (error) {
      console.error('Error creating student:', error.message);
      throw new Error(error.message);
    }

    return normalizeStudent(data);
  },
  
  // Update data siswa (otomatis hubungkan ke team_id jika group_name diubah)
  async updateStudent(id: string, updates: Partial<Student>) {
    const { group_name, ...rest } = updates as any;
    const payload: any = { ...rest };

    if (payload.full_name !== undefined) {
      payload.full_name = assertSafeText(payload.full_name, 'Nama Lengkap', 120);
    }
    if (payload.class_name !== undefined) {
      payload.class_name = assertSafeText(payload.class_name, 'Kelas', 50);
    }
    if (payload.nta !== undefined && payload.nta !== null) {
      payload.nta = assertSafeText(payload.nta, 'NTA', 60);
    }
    if (payload.qr_code_id !== undefined) {
      payload.qr_code_id = assertSafeText(payload.qr_code_id, 'QR Code ID', 120);
    }

    if (group_name !== undefined) {
      const teamId = await resolveTeamIdByName(group_name);
      if (teamId) {
        payload.team_id = teamId;
      }
    }

    const { data, error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id)
      .select('*, team:teams(id, name, gender)')
      .single();

    if (error) throw error;
    return normalizeStudent(data);
  },

  // Hapus siswa berdasarkan ID
  async deleteStudent(id: string) {
    const { data, error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase Delete Error:', error);
      throw new Error(error.message);
    }

    return data;
  }
};