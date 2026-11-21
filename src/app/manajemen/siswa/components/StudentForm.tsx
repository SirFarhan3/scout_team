'use client';

import { useState, useEffect, useMemo } from 'react';
import { App, Modal, Radio } from 'antd';
import { QrcodeOutlined } from '@ant-design/icons';
import { CreateStudentInput } from '@/types/student';
import { getAllTeams, TeamRecord } from '@/services/scoreService';
import { extractQrCodeId } from '@/lib/sanitize';
import QrCodePickerModal from './QrCodePickerModal';

interface StudentFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmitStudent: (studentData: CreateStudentInput) => Promise<any>;
}

const KELAS_PRESETS = ['5A', '5B', '6A', '6B', '7A', '8A', '9A', 'X', 'XI', 'XII'];

export default function StudentForm({
  open,
  onClose,
  onSuccess,
  onSubmitStudent,
}: StudentFormProps) {
  const { message } = App.useApp();
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('6A');
  const [gender, setGender] = useState<'Putra' | 'Putri'>('Putra');
  const [allTeams, setAllTeams] = useState<TeamRecord[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [nta, setNta] = useState('');
  const [customQrId, setCustomQrId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
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

  // Reset pilihan regu jika gender berubah dan regu lama tidak cocok dengan gender baru
  useEffect(() => {
    if (groupName && !filteredTeams.some((t) => t.name === groupName)) {
      setGroupName('');
    }
  }, [filteredTeams, groupName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !className) {
      message.error('Nama Lengkap dan Kelas wajib diisi!');
      return;
    }

    try {
      setSubmitting(true);
      const extractedQr = customQrId.trim() ? extractQrCodeId(customQrId) : undefined;
      await onSubmitStudent({
        full_name: fullName,
        class_name: className,
        group_name: groupName || undefined,
        nta: nta || undefined,
        qr_code_id: extractedQr || undefined,
      });

      message.success(
        extractedQr
          ? `Berhasil menambah siswa dengan QR Code ID: ${extractedQr}`
          : 'Berhasil menambah siswa! QR Code ID di-generate otomatis.'
      );
      setFullName('');
      setNta('');
      setCustomQrId('');
      onSuccess();
    } catch (error: any) {
      message.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
          ➕ Tambah Anggota Pramuka Baru
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={600}
      className="rounded-3xl overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
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

        {/* Input Kelas Fleksibel */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            Kelas *
          </label>
          <input
            type="text"
            list="kelas-preset-list"
            placeholder="Contoh: 6A, 7B, X-1"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            required
          />
          <datalist id="kelas-preset-list">
            {KELAS_PRESETS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>

        {/* Dropdown Regu dari Database (Opsional, Sesuai Gender Radio Button) */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            Nama Regu ({gender}) (Opsional)
          </label>
          <select
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            disabled={loadingTeams}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition disabled:opacity-50"
          >
            <option value="">
              {loadingTeams
                ? 'Memuat daftar regu...'
                : '-- Tanpa Regu / Belum Ditentukan --'}
            </option>
            {filteredTeams.map((team) => (
              <option key={team.id} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        {/* Input NTA */}
        <div>
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

        {/* Input / Scan QR Code ID / Link KTA AyoPramuka */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            QR Code ID / Link KTA AyoPramuka (Opsional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Kosongkan utk auto, atau tempel link AyoPramuka..."
              value={customQrId}
              onChange={(e) => {
                const val = e.target.value;
                setCustomQrId(val.includes('/') ? extractQrCodeId(val) : val);
              }}
              className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 placeholder-slate-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs px-3.5 py-3 rounded-2xl transition inline-flex items-center gap-1.5"
              title="Scan QR Kartu KTA AyoPramuka"
            >
              <QrcodeOutlined className="text-base" />
              <span>Scan QR</span>
            </button>
          </div>
        </div>

        {/* Button Submit */}
        <div className="md:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting
              ? 'Menyimpan...'
              : customQrId.trim()
              ? `✨ Simpan (QR ID: ${extractQrCodeId(customQrId)})`
              : '✨ Simpan & Generate QR'}
          </button>
        </div>
      </form>

      <QrCodePickerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(extractedId) => {
          setCustomQrId(extractedId);
          setScannerOpen(false);
          message.success(`QR KTA berhasil dibaca! Kode QR ID: ${extractedId}`);
        }}
      />
    </Modal>
  );
}
