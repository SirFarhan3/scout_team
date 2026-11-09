import { supabase } from '@/lib/supabase';

export interface UserSessionData {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'pembina' | 'instruktur';
}

export const authService = {
  // Login menggunakan Username & Password
  async login(username: string, pass: string): Promise<UserSessionData> {
    // 1. Cari user berdasarkan username
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, password_hash')
      .eq('username', username)
      .single();

    if (error || !user) {
      throw new Error('Username tidak ditemukan!');
    }

    // 2. Verifikasi Password menggunakan pgcrypto crypt() di Supabase RPC / SQL Match
    const { data: isValid, error: authError } = await supabase.rpc('verify_user_password', {
      user_id: user.id,
      password_input: pass,
    });

    if (authError || !isValid) {
      throw new Error('Password salah!');
    }

    const userData: UserSessionData = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    // 3. Simpan session user sederhana di localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('scout_session', JSON.stringify(userData));
    }

    return userData;
  },

  // Logout session
  async logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('scout_session');
    }
  },

  // Ambil data User dari session tersimpan
  async getCurrentUser(): Promise<UserSessionData | null> {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('scout_session');
      if (session) {
        return JSON.parse(session) as UserSessionData;
      }
    }
    return null;
  },
};