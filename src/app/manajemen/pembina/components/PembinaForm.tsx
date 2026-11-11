'use client';

import { useState, useEffect } from 'react';
import { message } from 'antd';
import { CreatePembinaInput, UpdatePembinaInput, PembinaUser } from '@/types/pembina';

interface PembinaFormProps {
  initialData?: PembinaUser | null;
  onSuccess: () => void;
  onSubmitPembina: (data: CreatePembinaInput) => Promise<void>;
  onUpdatePembina: (data: UpdatePembinaInput) => Promise<void>;
}

export default function PembinaForm({
  initialData,
  onSuccess,
  onSubmitPembina,
  onUpdatePembina,
}: PembinaFormProps) {
  const isEditing = Boolean(initialData);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'pembina' | 'instruktur'>('pembina');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setUsername(initialData.username);
      setFullName(initialData.full_name);
      setRole(initialData.role);
      setPassword(''); // Kosongkan password saat edit
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !fullName) {
      message.error('Nama lengkap dan username wajib diisi!');
      return;
    }

    if (!isEditing && !password) {
      message.error('Password wajib diisi untuk akun baru!');
      return;
    }

    try {
      setSubmitting(true);
      if (isEditing && initialData) {
        await onUpdatePembina({
          id: initialData.id,
          username,
          full_name: fullName,
          role,
          password: password || undefined,
        });
      } else {
        await onSubmitPembina({
          username,
          full_name: fullName,
          password,
          role,
        });
      }
      onSuccess();
    } catch (error: any) {
      message.error(`Gagal menyimpan data: ${error?.message || 'Terjadi kesalahan'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-3xl shadow-md border border-indigo-100 space-y-4 animate-in fade-in duration-200"
    >
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
        {isEditing ? '✏️ Edit Akun Pembina' : '➕ Buat Akun Pembina / Instruktur Baru'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Nama Lengkap
          </label>
          <input
            type="text"
            placeholder="Contoh: Kak Farhan Raihan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            required
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Username Login
          </label>
          <input
            type="text"
            placeholder="Contoh: kak_farhan"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            required
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Password {isEditing && <span className="text-slate-400 font-normal">(Opsional / Kosongkan jika tidak diubah)</span>}
          </label>
          <input
            type="password"
            placeholder={isEditing ? '•••••••• (Biarkan kosong jika tetap)' : '••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            required={!isEditing}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Role Akses
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          >
            <option value="pembina">Pembina</option>
            <option value="instruktur">Instruktur</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onSuccess}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200"
        >
          {submitting ? 'Menyimpan...' : isEditing ? 'Update Akun' : 'Simpan Akun'}
        </button>
      </div>
    </form>
  );
}