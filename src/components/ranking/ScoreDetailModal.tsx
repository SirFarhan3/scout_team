'use client';

import React from 'react';
import { Modal, Tag, Button, Popconfirm, message } from 'antd';
import {
  TrophyFilled,
  StarFilled,
  CheckCircleFilled,
  ThunderboltFilled,
  DeleteOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  BestTeamResult,
  BestStudentResult,
  deleteTeamScore,
  deleteStudentBonusPoint,
} from '@/services/scoreService';

interface ScoreDetailModalProps {
  open: boolean;
  onClose: () => void;
  type: 'team' | 'student';
  rank?: number;
  teamData?: BestTeamResult | null;
  studentData?: BestStudentResult | null;
  onRefresh?: () => void;
  onOpenAddScore?: () => void;
}

export default function ScoreDetailModal({
  open,
  onClose,
  type,
  rank,
  teamData,
  studentData,
  onRefresh,
  onOpenAddScore,
}: ScoreDetailModalProps) {
  const handleDeleteTeamScore = async (scoreId: string) => {
    try {
      await deleteTeamScore(scoreId);
      message.success('Riwayat poin regu berhasil dihapus');
      onRefresh?.();
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus poin');
    }
  };

  const handleDeleteStudentBonus = async (bonusId: string) => {
    try {
      await deleteStudentBonusPoint(bonusId);
      message.success('Riwayat poin keaktifan berhasil dihapus');
      onRefresh?.();
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus poin');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      centered
      title={null}
      styles={{ body: { padding: 0 } }}
    >
      {type === 'team' && teamData && (
        <div className="p-6 space-y-6 font-sans">
          {/* Header Regu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg font-black shadow-md shadow-amber-200">
                {rank ? `#${rank}` : <TrophyFilled />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">{teamData.name}</h3>
                  <Tag color="geekblue" className="rounded-full text-[10px] font-bold">
                    {teamData.gender || 'Penggalang'}
                  </Tag>
                </div>
                <p className="text-xs text-slate-500">
                  Total {teamData.memberCount} Anggota Terdaftar • Rincian Sumber Poin Regu
                </p>
              </div>
            </div>

            {onOpenAddScore && (
              <Button
                type="primary"
                onClick={onOpenAddScore}
                className="bg-indigo-600 hover:!bg-indigo-700 rounded-xl font-bold text-xs h-9"
              >
                + Tambah Skor Minigame
              </Button>
            )}
          </div>

          {/* 3 Kartu Rumus Skor Regu */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1">
                <CheckCircleFilled /> Poin Kehadiran QR
              </div>
              <div className="text-xl font-black text-emerald-800 mt-1">
                +{teamData.attendancePoints} <span className="text-xs font-semibold">Poin</span>
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                {teamData.totalAttendanceCount} kehadiran × 5 poin
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-amber-700 flex items-center gap-1">
                <ThunderboltFilled /> Poin Minigames / Bonus
              </div>
              <div className="text-xl font-black text-amber-800 mt-1">
                {teamData.bonusPoints >= 0 ? `+${teamData.bonusPoints}` : teamData.bonusPoints}{' '}
                <span className="text-xs font-semibold">Poin</span>
              </div>
              <div className="text-[11px] text-amber-600 mt-0.5 font-medium">
                Dari {teamData.scoreHistory.length} catatan kegiatan
              </div>
            </div>

            <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-md shadow-indigo-100">
              <div className="text-[10px] font-bold uppercase text-indigo-200 flex items-center gap-1">
                <StarFilled className="text-amber-300" /> Total Skor Akhir
              </div>
              <div className="text-2xl font-black mt-1">
                {teamData.totalScore} <span className="text-xs font-normal">Poin</span>
              </div>
              <div className="text-[11px] text-indigo-200 mt-0.5">
                Kehadiran + Poin Tambahan
              </div>
            </div>
          </div>

          {/* Riwayat Poin Tambahan / Minigames (team_scores) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>🎮</span> Riwayat Poin Minigames & Kegiatan Regu ({teamData.scoreHistory.length})
            </h4>

            {teamData.scoreHistory.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                Belum ada riwayat poin minigames atau penilaian tambahan untuk regu ini.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {teamData.scoreHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200/70 px-3.5 py-2.5 rounded-xl"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.description}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                          item.points >= 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.points >= 0 ? `+${item.points}` : item.points} Poin
                      </span>
                      <Popconfirm
                        title="Hapus catatan poin ini?"
                        onConfirm={() => handleDeleteTeamScore(item.id)}
                        okText="Ya, Hapus"
                        cancelText="Batal"
                      >
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                          title="Hapus poin"
                        >
                          <DeleteOutlined className="text-xs" />
                        </button>
                      </Popconfirm>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kontribusi Kehadiran Anggota */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TeamOutlined /> Kontribusi Kehadiran Anggota ({teamData.members.length} Siswa)
            </h4>

            {teamData.members.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                Belum ada anggota yang tergabung di regu ini.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {teamData.members.map((m, idx) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-white border border-slate-100 px-3.5 py-2 rounded-xl hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{m.full_name}</p>
                        <p className="text-[10px] text-slate-400">Kelas {m.class_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        {m.presentCount}x Hadir (+{m.attendancePoints} Poin)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {type === 'student' && studentData && (
        <div className="p-6 space-y-6 font-sans">
          {/* Header Siswa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-md shadow-indigo-200">
                {rank ? `#${rank}` : <UserOutlined />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">{studentData.full_name}</h3>
                  <Tag color="blue" className="rounded-full text-[10px] font-bold">
                    Kelas {studentData.class_name}
                  </Tag>
                </div>
                <p className="text-xs text-slate-500">
                  Regu: <strong>{studentData.group_name}</strong>
                  {studentData.nta ? ` • NTA: ${studentData.nta}` : ''}
                </p>
              </div>
            </div>

            {onOpenAddScore && (
              <Button
                type="primary"
                onClick={onOpenAddScore}
                className="bg-emerald-600 hover:!bg-emerald-700 rounded-xl font-bold text-xs h-9"
              >
                + Tambah Poin Keaktifan
              </Button>
            )}
          </div>

          {/* 4 Kartu Rumus Skor Individu */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-slate-500">Base Score</div>
              <div className="text-xl font-black text-slate-800 mt-1">{studentData.baseScore}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Nilai dasar siswa</div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-amber-700">Bonus Keaktifan</div>
              <div className="text-xl font-black text-amber-800 mt-1">
                {studentData.totalBonusPoints >= 0
                  ? `+${studentData.totalBonusPoints}`
                  : studentData.totalBonusPoints}
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">
                {studentData.bonusHistory.length} aktivitas/game
              </div>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-emerald-700">
                Nilai Keaktifan
              </div>
              <div className="text-xl font-black text-emerald-800 mt-1">
                {studentData.activeScore}{' '}
                <span className="text-[10px] font-semibold text-emerald-600">/ 100</span>
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">Max Ceiling 100</div>
            </div>

            <div className="bg-indigo-600 text-white p-3.5 rounded-2xl shadow-md shadow-indigo-100">
              <div className="text-[10px] font-bold uppercase text-indigo-200">
                Total Skor Ranking
              </div>
              <div className="text-xl font-black mt-1">
                {studentData.totalRankingScore} <span className="text-[10px] font-normal">Poin</span>
              </div>
              <div className="text-[10px] text-indigo-200 mt-0.5">
                Hadir (+{studentData.attendancePoints}) + Bonus
              </div>
            </div>
          </div>

          {/* Riwayat Poin Bonus Keaktifan / Minigames Individu */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>⚡</span> Riwayat Poin Keaktifan & Minigames ({studentData.bonusHistory.length})
            </h4>

            {studentData.bonusHistory.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                Belum ada tambahan poin keaktifan / minigame untuk siswa ini.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {studentData.bonusHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200/70 px-3.5 py-2.5 rounded-xl"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.description}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                          item.points >= 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.points >= 0 ? `+${item.points}` : item.points} Poin
                      </span>
                      <Popconfirm
                        title="Hapus catatan poin ini?"
                        onConfirm={() => handleDeleteStudentBonus(item.id)}
                        okText="Ya, Hapus"
                        cancelText="Batal"
                      >
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                          title="Hapus poin"
                        >
                          <DeleteOutlined className="text-xs" />
                        </button>
                      </Popconfirm>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Riwayat Kehadiran Scan QR */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckCircleFilled className="text-emerald-600" /> Riwayat Kehadiran Latihan (
              {studentData.presentCount} Hari Hadir = +{studentData.attendancePoints} Poin)
            </h4>
            {studentData.attendanceDates.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada catatan hadir.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {studentData.attendanceDates.map((dateStr) => (
                  <span
                    key={dateStr}
                    className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg"
                  >
                    ✅ {dateStr} (+5)
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
