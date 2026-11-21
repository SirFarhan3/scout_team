'use client';

import React, { useEffect, useState } from 'react';
import {
  CrownFilled,
  ThunderboltFilled,
  ReloadOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  getBestStudents,
  getBestTeams,
  BestStudentResult,
  BestTeamResult,
} from '@/services/scoreService';
import ScoreDetailModal from '@/components/ranking/ScoreDetailModal';
import MinigameScoreModal from '@/components/ranking/MinigameScoreModal';

interface RankStudentCardProps {
  initialStudents?: BestStudentResult[];
  initialTeams?: BestTeamResult[];
}

export default function RankStudentCard({
  initialStudents,
  initialTeams,
}: RankStudentCardProps = {}) {
  const [students, setStudents] = useState<BestStudentResult[]>(initialStudents || []);
  const [teams, setTeams] = useState<BestTeamResult[]>(initialTeams || []);
  const [loading, setLoading] = useState<boolean>(!initialStudents);
  const [error, setError] = useState<string | null>(null);

  // Modal Detail Siswa
  const [selectedStudent, setSelectedStudent] = useState<{
    student: BestStudentResult;
    rank: number;
  } | null>(null);

  // Modal Input Skor Individu
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [defaultStudentIdForModal, setDefaultStudentIdForModal] = useState<string | undefined>();

  const fetchStudentsRank = async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentsData, teamsData] = await Promise.all([
        getBestStudents(),
        getBestTeams(),
      ]);
      setStudents(studentsData);
      setTeams(teamsData);

      if (selectedStudent) {
        const updated = studentsData.find((s) => s.id === selectedStudent.student.id);
        const newRank = studentsData.findIndex((s) => s.id === selectedStudent.student.id) + 1;
        if (updated) {
          setSelectedStudent({ student: updated, rank: newRank });
        }
      }
    } catch (err: any) {
      console.error('Error loading best students:', err);
      setError(err.message || 'Gagal memuat peringkat siswa terbaik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialStudents) {
      fetchStudentsRank();
    }
  }, [initialStudents]);

  const getBadgeStyle = (rank: number) => {
    if (rank === 1) return 'bg-emerald-600 text-white';
    if (rank === 2) return 'bg-indigo-600 text-white';
    if (rank === 3) return 'bg-amber-600 text-white';
    return 'bg-slate-200 text-slate-700';
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌟</span>
          <h2 className="text-base font-bold text-slate-900">Peringkat Siswa Terbaik (Top 5)</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDefaultStudentIdForModal(students[0]?.id);
              setShowScoreModal(true);
            }}
            className="text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
          >
            <PlusOutlined /> Poin Siswa
          </button>
          <button
            type="button"
            onClick={fetchStudentsRank}
            disabled={loading}
            title="Segarkan Peringkat Siswa"
            className="text-xs text-slate-500 hover:text-emerald-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <ReloadOutlined spin={loading} />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 font-medium">
        Berdasarkan akumulasi kehadiran (+5/hadir) & poin keaktifan individu (Nilai Dasar 80 + Bonus, Max 100).
      </p>

      {loading ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-slate-100 bg-slate-50 animate-pulse flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="w-32 h-3.5 bg-slate-200 rounded" />
                  <div className="w-40 h-2.5 bg-slate-200 rounded" />
                </div>
              </div>
              <div className="w-20 h-6 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          ⚠️ {error}
        </div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
          <p className="text-xs font-semibold text-slate-400">
            Belum ada data siswa yang terdaftar.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          {students.slice(0, 5).map((item, idx) => {
            const rank = idx + 1;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedStudent({ student: item, rank })}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                  rank === 1
                    ? 'bg-gradient-to-r from-emerald-50/60 to-white border-emerald-200 hover:border-emerald-300 shadow-sm'
                    : 'bg-slate-50 border-slate-200/60 hover:border-emerald-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-sm ${getBadgeStyle(
                      rank
                    )}`}
                  >
                    {rank === 1 ? <CrownFilled /> : `#${rank}`}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-800 truncate">
                        {item.full_name}
                      </h4>
                      <span className="text-[9px] font-semibold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded">
                        Kelas {item.class_name}
                      </span>
                      <span className="text-[9px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                        {item.group_name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Nilai Aktif: <strong className="text-emerald-700">{item.activeScore}/100</strong> •{' '}
                      {item.presentCount}x Hadir (+{item.attendancePoints})
                      {item.totalBonusPoints !== 0 && (
                        <span className="text-amber-600 font-semibold">
                          {' '}
                          • Bonus {item.totalBonusPoints > 0 ? `+${item.totalBonusPoints}` : item.totalBonusPoints}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Skor + Tombol Detail */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                    <ThunderboltFilled className="text-amber-500 text-[10px]" /> {item.totalRankingScore} Poin
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStudent({ student: item, rank });
                    }}
                    className="text-[11px] font-bold text-slate-600 hover:text-emerald-600 bg-white border border-slate-200 hover:border-emerald-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
                  >
                    <EyeOutlined /> Detail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => (window.location.href = '/ranking?tab=student')}
        className="w-full text-center py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl transition border border-dashed border-emerald-200 block"
      >
        🌟 Lihat Seluruh Peringkat & Keaktifan Siswa →
      </button>

      {/* Modal Detail Siswa */}
      <ScoreDetailModal
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        type="student"
        rank={selectedStudent?.rank}
        studentData={selectedStudent?.student}
        onRefresh={fetchStudentsRank}
        onOpenAddScore={() => {
          const studentId = selectedStudent?.student.id;
          setSelectedStudent(null);
          setDefaultStudentIdForModal(studentId);
          setShowScoreModal(true);
        }}
      />

      {/* Modal Input Skor Individu */}
      <MinigameScoreModal
        open={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        defaultTargetType="student"
        defaultStudentId={defaultStudentIdForModal}
        teams={teams}
        students={students}
        onSuccess={fetchStudentsRank}
      />
    </div>
  );
}
