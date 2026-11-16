'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, Input, InputNumber, message } from 'antd';
import {
  TrophyFilled,
  ThunderboltFilled,
  TeamOutlined,
  UserOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  BestTeamResult,
  BestStudentResult,
  PointPreset,
  getPointPresets,
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
  const [actionMode, setActionMode] = useState<'add' | 'deduct'>('add');
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(defaultTeamId);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(defaultStudentId);
  const [pointsMagnitude, setPointsMagnitude] = useState<number>(10);
  const [description, setDescription] = useState<string>('');
  const [presets, setPresets] = useState<PointPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load presets dari database saat modal dibuka atau targetType berganti
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadingPresets(true);
    getPointPresets(targetType)
      .then((data) => {
        if (mounted) setPresets(data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingPresets(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, targetType]);

  useEffect(() => {
    if (open) {
      setTargetType(defaultTargetType);
      setActionMode('add');
      setSelectedTeamId(defaultTeamId || teams[0]?.id);
      setSelectedStudentId(defaultStudentId || students[0]?.id);
      setPointsMagnitude(defaultTargetType === 'team' ? 15 : 5);
      setDescription('');
    }
  }, [open, defaultTargetType, defaultTeamId, defaultStudentId, teams, students]);

  const handleApplyPreset = (preset: PointPreset) => {
    setDescription(preset.title);
    if (preset.points < 0) {
      setActionMode('deduct');
      setPointsMagnitude(Math.abs(preset.points));
    } else {
      setActionMode('add');
      setPointsMagnitude(Math.abs(preset.points));
    }
  };

  // Nilai poin bertanda (+ atau -)
  const effectivePoints =
    actionMode === 'deduct' ? -Math.abs(pointsMagnitude) : Math.abs(pointsMagnitude);

  const handleSubmit = async () => {
    if (!pointsMagnitude || pointsMagnitude <= 0) {
      message.warning('Masukkan jumlah poin lebih dari 0');
      return;
    }

    try {
      setSubmitting(true);
      if (targetType === 'team') {
        if (!selectedTeamId) {
          message.warning('Pilih regu terlebih dahulu');
          return;
        }
        await addTeamScore({
          team_id: selectedTeamId,
          points: effectivePoints,
          description,
        });
        message.success(
          actionMode === 'add'
            ? `Berhasil menambahkan +${Math.abs(effectivePoints)} poin ke regu!`
            : `Berhasil mengurangi ${effectivePoints} poin dari regu!`
        );
      } else {
        if (!selectedStudentId) {
          message.warning('Pilih siswa terlebih dahulu');
          return;
        }
        await addStudentBonusPoint({
          student_id: selectedStudentId,
          points: effectivePoints,
          description,
        });
        message.success(
          actionMode === 'add'
            ? `Berhasil menambahkan +${Math.abs(effectivePoints)} poin ke siswa!`
            : `Berhasil mengurangi ${effectivePoints} poin dari siswa!`
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || 'Gagal menyimpan poin');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPresets = presets.filter((p) =>
    actionMode === 'add' ? p.points >= 0 : p.points < 0
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
      title={null}
    >
      <div className="space-y-5 font-sans pt-1">
        {/* Header Modal */}
        <div className="flex items-start justify-between gap-2 pr-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span>🎮</span> Tambah / Kurangi Poin Ranking
            </h3>
            <p className="text-xs text-slate-500">
              Pilih dari katalog poin di database atau masukkan keterangan penilaian manual.
            </p>
          </div>
          <button
            type="button"
            onClick={() => (window.location.href = '/manajemen/poin')}
            className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition flex items-center gap-1 shrink-0"
          >
            <SettingOutlined /> Kelola Master Poin
          </button>
        </div>

        {/* 1. Toggle Pilih Target: Regu vs Individu */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setTargetType('team');
              setPointsMagnitude(15);
              setDescription('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              targetType === 'team'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TeamOutlined /> Poin Regu
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetType('student');
              setPointsMagnitude(5);
              setDescription('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              targetType === 'student'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserOutlined /> Poin Individu (Siswa)
          </button>
        </div>

        {/* 2. Toggle Jenis Aksi: Tambah Poin (+) vs Kurangi Poin (-) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActionMode('add');
              setDescription('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition flex items-center justify-center gap-1.5 ${
              actionMode === 'add'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50/50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <PlusCircleOutlined /> Tambah Poin (+ Reward / Game)
          </button>
          <button
            type="button"
            onClick={() => {
              setActionMode('deduct');
              setDescription('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition flex items-center justify-center gap-1.5 ${
              actionMode === 'deduct'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-rose-50/50 text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <MinusCircleOutlined /> Kurangi Poin (- Evaluasi / Sanksi)
          </button>
        </div>

        {/* 3. Pilih Target Regu / Siswa */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
            {targetType === 'team' ? 'Pilih Regu' : 'Pilih Siswa'}
          </label>

          {targetType === 'team' ? (
            <Select
              showSearch
              optionFilterProp="label"
              value={selectedTeamId}
              onChange={(val) => setSelectedTeamId(val)}
              placeholder="Pilih regu..."
              className="w-full h-10"
              options={teams.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.gender || 'Campuran'} • Skor: ${t.totalScore} Poin)`,
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
                label: `${s.full_name} — Kelas ${s.class_name} (${s.group_name}) • Aktif: ${s.activeScore}/100 • Total: ${s.totalRankingScore} Poin`,
              }))}
            />
          )}
        </div>

        {/* 4. Daftar Katalog Poin dari Database */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase">
              📋 Pilih Katalog Poin dari Database ({filteredPresets.length} Item)
            </label>
          </div>
          {loadingPresets ? (
            <div className="text-xs text-slate-400 py-2">Memuat daftar poin dari database...</div>
          ) : filteredPresets.length === 0 ? (
            <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
              Belum ada katalog poin untuk kategori ini. Anda bisa menambahkannya di menu{' '}
              <a href="/manajemen/poin" className="text-indigo-600 font-bold underline">
                Manajemen Poin
              </a>{' '}
              atau ketik manual di bawah.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {filteredPresets.map((preset) => {
                const isSelected =
                  description === preset.title &&
                  pointsMagnitude === Math.abs(preset.points);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border transition ${
                      isSelected
                        ? actionMode === 'add'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-rose-600 text-white border-rose-600'
                        : preset.points >= 0
                        ? 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                        : 'bg-rose-50/70 hover:bg-rose-100 text-rose-700 border-rose-200'
                    }`}
                  >
                    {preset.title}{' '}
                    <span className="font-extrabold">
                      ({preset.points >= 0 ? `+${preset.points}` : preset.points})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Input Deskripsi & Poin */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Nama Penilaian / Keterangan *
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                actionMode === 'add'
                  ? 'Contoh: Juara 1 Minigame Semaphore'
                  : 'Contoh: Atribut Tidak Lengkap saat Apel'
              }
              className="rounded-xl h-10 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Nominal Poin ({actionMode === 'add' ? '+' : '-'}) *
            </label>
            <InputNumber
              value={pointsMagnitude}
              onChange={(val) => setPointsMagnitude(Math.max(1, Math.abs(Number(val) || 0)))}
              min={1}
              max={500}
              step={5}
              addonBefore={
                <span
                  className={`font-black text-xs ${
                    actionMode === 'add' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {actionMode === 'add' ? '+' : '−'}
                </span>
              }
              className="w-full rounded-xl h-10 flex items-center text-xs font-bold"
            />
          </div>
        </div>

        {/* 6. Tombol Simpan */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button onClick={onClose} className="rounded-xl h-10 px-4 text-xs font-semibold">
            Batal
          </Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            icon={actionMode === 'add' ? <TrophyFilled /> : <ThunderboltFilled />}
            className={`rounded-xl h-10 px-5 text-xs font-bold border-none ${
              actionMode === 'add'
                ? 'bg-emerald-600 hover:!bg-emerald-700'
                : 'bg-rose-600 hover:!bg-rose-700'
            }`}
          >
            {actionMode === 'add'
              ? `Tambahkan +${pointsMagnitude} Poin`
              : `Kurangi -${pointsMagnitude} Poin`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
