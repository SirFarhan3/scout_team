'use client';

import { useState, useEffect, useMemo } from 'react';
import { message, Radio } from 'antd';
import { CreateStudentInput } from '@/types/student';
import { getAllTeams, TeamRecord } from '@/services/scoreService';

interface StudentFormProps {
  onSuccess: () => void;
  onSubmitStudent: (studentData: CreateStudentInput) => Promise<any>;
}

const KELAS_OPTIONS = ['6A', '6B', '5A', '5B'];

export default function StudentForm({ onSuccess, onSubmitStudent }: StudentFormProps) {
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState(KELAS_OPTIONS[0]);
  const [gender, setGender] = useState<'Putra' | 'Putri'>('Putra');
  const [allTeams, setAllTeams] = useState<TeamRecord[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [nta, setNta] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ambil daftar regu dari database
  useEffect(() => {
    let mounted = true;
    setLoadingTeams(true);
    getAllTeams()
      .then((teams) => {
        if (!mounted) return;
        setAllTeams(teams || []);
      })
      .catch((err) => {
        console.error('Gagal mengambil daftar regu dari DB:', err);
        message.error('Gagal memuat daftar regu dari database');
      })
      .finally(() => {
        if (mounted) setLoadingTeams(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Filter daftar regu berdasarkan gender yang dipilih di radio button
  const filteredTeams = useMemo(() => {
    return allTeams.filter(
      (t) => (t.gender || '').toLowerCase() === gender.toLowerCase()
    );
  }, [allTeams, gender]);

  // Set default pilihan regu setiap kali daftar regu atau pilihan gender berubah
  useEffect(() => {
    if (filteredTeams.length > 0) {
      const stillValid = filteredTeams.some((t) => t.name === groupName);
      if (!stillValid) {
        setGroupName(filteredTeams[0].name);
      }
    } else {
      setGroupName('');
    }
  }, [filteredTeams, groupName]);

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
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            Nama Lengkap *
          </label>
          <input
            type="text"
            placeholder="Contoh: Andri Hisbah"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>

        {/* Radio Button Gender (Putra / Putri) */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
            Jenis Kelamin / Kategori Regu *
          </label>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-6">
            <Radio.Group
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="flex items-center gap-6"
            >
              <Radio value="Putra" className="text-sm font-semibold text-slate-800">
                👦 Putra
              </Radio>
              <Radio value="Putri" className="text-sm font-semibold text-slate-800">
                👧 Putri
              </Radio>
            </Radio.Group>
            <span className="text-[11px] text-slate-400 font-medium ml-auto">
              ({filteredTeams.length} Regu {gender} tersedia)
            </span>
          </div>
        </div>

        {/* Dropdown Kelas */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            Kelas *
          </label>
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

        {/* Dropdown Regu dari Database (Sesuai Gender Radio Button) */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            Nama Regu ({gender}) *
          </label>
          <select
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            disabled={loadingTeams || filteredTeams.length === 0}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition disabled:opacity-50"
          >
            {loadingTeams ? (
              <option value="">Memuat daftar regu...</option>
            ) : filteredTeams.length === 0 ? (
              <option value="">Belum ada regu {gender} di database</option>
            ) : (
              filteredTeams.map((team) => (
                <option key={team.id} value={team.name}>
                  {team.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Input NTA */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            NTA (Opsional)
          </label>
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
            disabled={submitting || loadingTeams || !groupName}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? 'Generating QR & Saving...' : '✨ Simpan & Generate QR Code'}
          </button>
        </div>
      </form>
    </div>
  );
}
