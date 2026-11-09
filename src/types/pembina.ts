export type UserRole = 'admin' | 'pembina' | 'instruktur';

export interface PembinaUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  created_at?: string;
}

export interface CreatePembinaInput {
  username: string;
  full_name: string;
  password: string;
  role: UserRole;
}

export interface UpdatePembinaInput {
  id: string;
  username: string;
  full_name: string;
  password?: string;
  role: UserRole;
}