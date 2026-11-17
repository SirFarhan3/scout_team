import { supabase } from '@/lib/supabase';
import { isAllowedRole, AllowedRole, assertSafeText } from '@/lib/sanitize';

export interface UserSessionData {
  id: string;
  username: string;
  full_name: string;
  role: AllowedRole;
}

const SESSION_KEY = 'scout_session';

export const authService = {
  // Login menggunakan Username & Password
  async login(username: string, pass: string): Promise<UserSessionData> {
    const cleanUsername = assertSafeText(username, 'Username', 50);
    if (!cleanUsername || !pass) {
      throw new Error('Username dan password wajib diisi!');
    }

    // 1. Cari user TANPA menarik kolom password_hash ke client
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, role')
      .eq('username', cleanUsername)
      .limit(1);

    const foundUser = user && user.length > 0 ? user[0] : null;

    if (error || !foundUser) {
      // Pesan seragam untuk mencegah User Enumeration
      throw new Error('Username atau password salah!');
    }

    // 2. Verifikasi Password menggunakan pgcrypto crypt() di Supabase RPC
    const { data: isValid, error: authError } = await supabase.rpc('verify_user_password', {
      user_id: foundUser.id,
      password_input: pass,
    });

    if (authError || !isValid) {
      // Pesan seragam untuk mencegah User Enumeration
      throw new Error('Username atau password salah!');
    }

    const userData: UserSessionData = {
      id: String(foundUser.id),
      username: String(foundUser.username),
      full_name: String(foundUser.full_name),
      role: isAllowedRole(foundUser.role) ? foundUser.role : 'instruktur',
    };

    // 3. Simpan session sementara di localStorage (disarankan migrasi ke HttpOnly cookie server)
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    }

    return userData;
  },

  // Logout session
  async logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  },

  // Ambil data User dari session tersimpan dengan validasi skema
  async getCurrentUser(): Promise<UserSessionData | null> {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.id !== 'string' ||
        typeof parsed.username !== 'string' ||
        typeof parsed.full_name !== 'string' ||
        !isAllowedRole(parsed.role)
      ) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed as UserSessionData;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },
};
