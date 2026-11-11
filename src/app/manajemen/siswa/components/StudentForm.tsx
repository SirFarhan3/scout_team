'use client';

import { useState } from 'react';
import { message } from 'antd';

import { CreateStudentInput } from '@/types/student';

interface StudentFormProps {
  onSuccess: () => void;
  onSubmitStudent: (studentData: CreateStudentInput) => Promise<any>;
}
// Data Master Options untuk Dropdown
const KELAS_OPTIONS = ['7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];
const REGU_OPTIONS = [
  'Regu Elang',
  'Regu Garuda',
  'Regu Harimau',
  'Regu Kobra',
  'Regu Melati',
  'Regu Mawar',
  'Regu Anggrek',
  'Regu Dahlia',
];

export default function StudentForm({ onSuccess, onSubmitStudent }: StudentFormProps) {
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState(KELAS_OPTIONS[0]);
  const [groupName, setGroupName] = useState(REGU_OPTIONS[0]);
  const [nta, setNta] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !className || !groupName) {
      message.error('Nama, Kelas, dan Regu wajib diisi!');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmitStudent({
        full_name: fullName,
        class_name: className,
        group_name: groupName,
        nta: nta || undefined,
      });

      message.success('Berhasil menambah siswa! QR Code ID di-generate otomatis.');
      setFullName('');
      setNta('');
      onSuccess();
    } catch (error: any) {
      message.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
          ➕
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tambah Anggota Penggalang</h2>
          <p className="text-xs text-slate-400">QR Code ID akan dibuatkan otomatis oleh sistem</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Nama Lengkap */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Lengkap *</label>
          <input
            type="text"
            placeholder="Contoh: Farhan Raihan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>

        {/* Dropdown Kelas */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Kelas *</label>
          <select
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          >
            {KELAS_OPTIONS.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown Regu */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Regu *</label>
          <select
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          >
            {REGU_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Input NTA */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">NTA (Opsional)</label>
          <input
            type="text"
            placeholder="Contoh: 12.34.5678"
            value={nta}
            onChange={(e) => setNta(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>

        {/* Button Submit */}
        <div className="md:col-span-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? 'Generating QR & Saving...' : '✨ Simpan & Generate QR Code'}
          </button>
        </div>
      </form>
    </div>
  );
}