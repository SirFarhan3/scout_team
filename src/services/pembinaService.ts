import { supabase } from '@/lib/supabase';
import { PembinaUser, CreatePembinaInput, UpdatePembinaInput } from '@/types/pembina';

export const pembinaService = {
  // Ambil semua daftar Pembina / User
  async getAllPembina(): Promise<PembinaUser[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Tambah Pembina / User Baru
  async createPembina(input: CreatePembinaInput): Promise<PembinaUser> {
    const { data, error } = await supabase.rpc('create_new_user', {
      username_input: input.username,
      full_name_input: input.full_name,
      password_input: input.password,
      role_input: input.role,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  // Update Data Pembina
  async updatePembina(input: UpdatePembinaInput): Promise<PembinaUser> {
    const updatePayload: any = {
      username: input.username,
      full_name: input.full_name,
      role: input.role,
    };

    if (input.password && input.password.trim() !== '') {
      const { data: hashedPassword, error: hashErr } = await supabase.rpc('hash_password', {
        raw_password: input.password,
      });
      if (hashErr) throw new Error(hashErr.message);
      updatePayload.password_hash = hashedPassword;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', input.id)
      .select('id, username, full_name, role, created_at');

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error('Gagal memperbarui data user. Pastikan ID valid.');
    }

    return data[0];
  },

  // Hapus Pembina / User
  async deletePembina(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};