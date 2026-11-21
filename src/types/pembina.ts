export type UserRole = 'superadmin' | 'admin' | 'pembina' | 'instruktur';

export interface PembinaUser {
  id: string;
  school_id?: string | null;
  username: string;
  full_name: string;
  role: UserRole;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

export interface CreatePembinaInput {
  username: string;
  full_name: string;
  password: string;
  role: Exclude<UserRole, 'superadmin'>;
}

export interface UpdatePembinaInput {
  id: string;
  username: string;
  full_name: string;
  password?: string;
  role: Exclude<UserRole, 'superadmin'>;
  is_active?: boolean;
}
