'use client';

import { useState, useEffect } from 'react';
import { App, Modal } from 'antd';
import { CreatePembinaInput, UpdatePembinaInput, PembinaUser } from '@/types/pembina';
import PasswordInput from '@/components/PasswordInput';

interface PembinaFormProps {
  open: boolean;
  initialData?: PembinaUser | null;
  onSuccess: () => void;
  onSubmitPembina: (data: CreatePembinaInput) => Promise<void>;
  onUpdatePembina: (data: UpdatePembinaInput) => Promise<void>;
}

export default function PembinaForm({
  open,
  initialData,
  onSuccess,
  onSubmitPembina,
  onUpdatePembina,
}: PembinaFormProps) {
  const { message } = App.useApp();
  const isEditing = Boolean(initialData);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'pembina' | 'instruktur'>('pembina');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setUsername(initialData.username);
      setFullName(initialData.full_name);
      setRole(
        initialData.role === 'admin' || initialData.role === 'instruktur'
          ? initialData.role
          : 'pembina'
      );
      setIsActive(initialData.is_active !== false);
      setPassword('');
    } else {
      setUsername('');
      setFullName('');
      setPassword('');
      setRole('pembina');
      setIsActive(true);
    }
  }, [initialData, open]);

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
          is_active: isActive,
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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Terjadi kesalahan';
      message.error(`Gagal menyimpan data: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
          {isEditing
            ? '✏️ Edit Akun Pembina / Pembantu Pembina'
            : '➕ Buat Akun Pembina / Pembantu Pembina Baru'}
        </div>
      }
      open={open}
      onCancel={onSuccess}
      footer={null}
      centered
      width={560}
      className="rounded-3xl overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              placeholder="Contoh: Kak Andri Hisbah"
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
              placeholder="Contoh: kak_Andri"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Password{' '}
              {isEditing ? (
                <span className="text-slate-400 font-normal">(Opsional / Min 8 char + angka)</span>
              ) : (
                <span className="text-slate-400 font-normal">(Min 8 char, huruf & angka)</span>
              )}
            </label>
            <PasswordInput
              placeholder={
                isEditing ? '•••••••• (Biarkan kosong jika tetap)' : 'Min 8 karakter + angka'
              }
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
              onChange={(e) =>
                setRole(e.target.value as 'admin' | 'pembina' | 'instruktur')
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            >
              <option value="pembina">Pembina</option>
              <option value="instruktur">Pembantu Pembina</option>
              <option value="admin">Admin Sekolah</option>
            </select>
          </div>

          {isEditing && (
            <div className="sm:col-span-2 flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
              <input
                id="pembina-active-toggle"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              <label
                htmlFor="pembina-active-toggle"
                className="text-xs font-bold text-slate-700 cursor-pointer"
              >
                Akun Aktif (Jika dinonaktifkan, user tidak dapat login dan semua sesinya langsung dicabut)
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
    </Modal>
  );
}
