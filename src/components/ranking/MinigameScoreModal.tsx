'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, Input, InputNumber, message } from 'antd';
import {
  TrophyFilled,
  ThunderboltFilled,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  BestTeamResult,
  BestStudentResult,
  addTeamScore,
  addStudentBonusPoint,
} from '@/services/scoreService';

interface MinigameScoreModalProps {
  open: boolean;
  onClose: () => void;
  defaultTargetType?: 'team' | 'student';
  defaultTeamId?: string;
  defaultStudentId?: string;
  teams: BestTeamResult[];
  students: BestStudentResult[];
  onSuccess: () => void;
}

const TEAM_PRESETS = [
  { label: '🏆 Juara 1 Minigame / Lomba', points: 25, desc: 'Juara 1 Minigame / Lomba Pramuka' },
  { label: '🥈 Juara 2 Minigame / Lomba', points: 15, desc: 'Juara 2 Minigame / Lomba Pramuka' },
  { label: '🥉 Juara 3 Minigame / Lomba', points: 10, desc: 'Juara 3 Minigame / Lomba Pramuka' },
  { label: '📣 Yel-Yel & Kekompakan Terbaik', points: 15, desc: 'Regu dengan Yel-Yel & Kekompakan Terbaik' },
  { label: '⛺ Pionering Tercepat & Rapi', points: 20, desc: 'Pemenang Tantangan Pionering / Tenda' },
  { label: '🧭 Kuis Sandi & Semaphore', points: 15, desc: 'Skor Minigame Sandi Morse & Semaphore' },
  { label: '⚠️ Kurang Kompak / Pelanggaran', points: -10, desc: 'Pengurangan Poin Kedisiplinan Regu' },
];

const STUDENT_PRESETS = [
  { label: '🙋 Menjawab Pertanyaan Pembina', points: 5, desc: 'Aktif Menjawab Pertanyaan Materi' },
  { label: '🎯 Pemenang Kuis / Minigame Individu', points: 10, desc: 'Juara Kuis / Minigame Individu' },
  { label: '🎖️ Lulus Uji Poin SKU / SKK', points: 10, desc: 'Berhasil Lulus Uji Materi SKU/SKK' },
  { label: '👕 Atribut Pramuka Lengkap & Rapi', points: 5, desc: 'Kerapian & Kelengkapan Atribut Pramuka' },
  { label: '🤝 Memimpin Barisan / Membantu Regu', points: 5, desc: 'Inisiatif Memimpin & Membantu Kegiatan' },
  { label: '⚠️ Atribut Kurang / Kurang Tertib', points: -5, desc: 'Catatan Evaluasi Kedisiplinan Atribut' },
];

export default function MinigameScoreModal({
  open,
  onClose,
  defaultTargetType = 'team',
  defaultTeamId,
  defaultStudentId,
  teams,
  students,
  onSuccess,
}: MinigameScoreModalProps) {
  const [targetType, setTargetType] = useState<'team' | 'student'>(defaultTargetType);
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(defaultTeamId);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(defaultStudentId);
  const [points, setPoints] = useState<number>(10);
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setTargetType(defaultTargetType);
      setSelectedTeamId(defaultTeamId || teams[0]?.id);
      setSelectedStudentId(defaultStudentId || students[0]?.id);
      setPoints(defaultTargetType === 'team' ? 15 : 5);
      setDescription('');
    }
  }, [open, defaultTargetType, defaultTeamId, defaultStudentId, teams, students]);

  const handleApplyPreset = (preset: { points: number; desc: string }) => {
    setPoints(preset.points);
    setDescription(preset.desc);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      if (targetType === 'team') {
        if (!selectedTeamId) {
          message.warning('Pilih regu terlebih dahulu');
          return;
        }
        await addTeamScore({
          team_id: selectedTeamId,
          points,
          description,
        });
        message.success('Skor minigame / kegiatan regu berhasil ditambahkan!');
      } else {
        if (!selectedStudentId) {
          message.warning('Pilih siswa terlebih dahulu');
          return;
        }
        await addStudentBonusPoint({
          student_id: selectedStudentId,
          points,
          description,
        });
        message.success('Poin keaktifan individu siswa berhasil ditambahkan!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || 'Gagal menyimpan skor');
    } finally {
      setSubmitting(false);
    }
  };

  const presets = targetType === 'team' ? TEAM_PRESETS : STUDENT_PRESETS;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      centered
      title={null}
    >
      <div className="space-y-5 font-sans pt-1">
        {/* Header Modal */}
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span>🎮</span> Input Skor Minigames & Keaktifan
          </h3>
          <p className="text-xs text-slate-500">
            Berikan poin tambahan dari hasil minigames, kuis, lomba, atau keaktifan latihan.
          </p>
        </div>

        {/* Toggle Pilih Mode: Regu vs Individu */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setTargetType('team');
              setPoints(15);
              setDescription('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              targetType === 'team'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TeamOutlined /> Skor Regu
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetType('student');
              setPoints(5);
              setDescription('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              targetType === 'student'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserOutlined /> Keaktifan Individu
          </button>
        </div>

        {/* Pilih Target Regu / Siswa */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
            {targetType === 'team' ? 'Pilih Regu Penerima Skor' : 'Pilih Siswa Penerima Poin'}
          </label>

          {targetType === 'team' ? (
            <Select
              value={selectedTeamId}
              onChange={(val) => setSelectedTeamId(val)}
              placeholder="Pilih regu..."
              className="w-full h-10"
              options={teams.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.gender || 'Penggalang'} • Skor Saat Ini: ${t.totalScore} Poin)`,
              }))}
            />
          ) : (
            <Select
              showSearch
              value={selectedStudentId}
              onChange={(val) => setSelectedStudentId(val)}
              placeholder="Ketik nama siswa..."
              optionFilterProp="label"
              className="w-full h-10"
              options={students.map((s) => ({
                value: s.id,
                label: `${s.full_name} — Kelas ${s.class_name} (${s.group_name}) • Nilai Aktif: ${s.activeScore}/100`,
              }))}
            />
          )}
        </div>

        {/* Preset Cepat Minigames */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
            ⚡ Pilih Cepat Minigame / Aktivitas (Opsional)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border transition ${
                  description === preset.desc && points === preset.points
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : preset.points >= 0
                    ? 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border-slate-200'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                }`}
              >
                {preset.label}{' '}
                <span className="font-extrabold">
                  ({preset.points >= 0 ? `+${preset.points}` : preset.points})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Deskripsi & Poin */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Nama Minigame / Keterangan Penilaian
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                targetType === 'team'
                  ? 'Contoh: Juara 1 Minigame Sandi Morse'
                  : 'Contoh: Menjawab Kuis Sejarah Pramuka'
              }
              className="rounded-xl h-10 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Jumlah Poin
            </label>
            <InputNumber
              value={points}
              onChange={(val) => setPoints(Number(val) || 0)}
              min={-100}
              max={100}
              step={5}
              className="w-full rounded-xl h-10 flex items-center text-xs font-bold"
            />
          </div>
        </div>

        {/* Tombol Simpan */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button onClick={onClose} className="rounded-xl h-10 px-4 text-xs font-semibold">
            Batal
          </Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            icon={targetType === 'team' ? <TrophyFilled /> : <ThunderboltFilled />}
            className={`rounded-xl h-10 px-5 text-xs font-bold ${
              targetType === 'team'
                ? 'bg-indigo-600 hover:!bg-indigo-700'
                : 'bg-emerald-600 hover:!bg-emerald-700'
            }`}
          >
            Simpan Poin {targetType === 'team' ? 'Regu' : 'Individu'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
