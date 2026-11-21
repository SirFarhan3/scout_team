'use client';

import React, { useEffect, useState } from 'react';
import {
  TrophyFilled,
  FireFilled,
  StarFilled,
  ReloadOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  getBestTeams,
  getBestStudents,
  BestTeamResult,
  BestStudentResult,
} from '@/services/scoreService';
import ScoreDetailModal from '@/components/ranking/ScoreDetailModal';
import MinigameScoreModal from '@/components/ranking/MinigameScoreModal';

interface RankReguCardProps {
  initialTeams?: BestTeamResult[];
  initialStudents?: BestStudentResult[];
}

export default function RankReguCard({
  initialTeams,
  initialStudents,
}: RankReguCardProps = {}) {
  const [teams, setTeams] = useState<BestTeamResult[]>(initialTeams || []);
  const [students, setStudents] = useState<BestStudentResult[]>(initialStudents || []);
  const [loading, setLoading] = useState<boolean>(!initialTeams);
  const [error, setError] = useState<string | null>(null);

  // Modal Detail Regu
  const [selectedTeam, setSelectedTeam] = useState<{
    team: BestTeamResult;
    rank: number;
  } | null>(null);

  // Modal Input Skor Minigame
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [defaultTeamIdForModal, setDefaultTeamIdForModal] = useState<string | undefined>();

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const [teamsData, studentsData] = await Promise.all([
        getBestTeams(),
        getBestStudents(),
      ]);
      setTeams(teamsData);
      setStudents(studentsData);

      // Update selectedTeam jika modal sedang terbuka
      if (selectedTeam) {
        const updated = teamsData.find((t) => t.id === selectedTeam.team.id);
        const newRank = teamsData.findIndex((t) => t.id === selectedTeam.team.id) + 1;
        if (updated) {
          setSelectedTeam({ team: updated, rank: newRank });
        }
      }
    } catch (err: any) {
      console.error('Error loading best teams:', err);
      setError(err.message || 'Gagal memuat peringkat regu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialTeams) {
      fetchLeaderboard();
    }
  }, [initialTeams]);

  const getBadgeStyle = (rank: number) => {
    if (rank === 1) return 'bg-amber-500 text-white';
    if (rank === 2) return 'bg-slate-300 text-slate-800';
    if (rank === 3) return 'bg-amber-700 text-white';
    return 'bg-slate-200 text-slate-700';
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h2 className="text-base font-bold text-slate-900">Peringkat Regu Terbaik (Top 5)</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDefaultTeamIdForModal(teams[0]?.id);
              setShowScoreModal(true);
            }}
            className="text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
          >
            <PlusOutlined /> Skor Game
          </button>
          <button
            type="button"
            onClick={fetchLeaderboard}
            disabled={loading}
            title="Segarkan Peringkat"
            className="text-xs text-slate-500 hover:text-indigo-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <ReloadOutlined spin={loading} />
          </button>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
            <FireFilled /> Live
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 font-medium">
        Klik pada baris regu atau tombol <strong>Detail</strong> untuk melihat rincian poin kehadiran & minigames.
      </p>

      {/* Loading State */}
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
                  <div className="w-28 h-3.5 bg-slate-200 rounded" />
                  <div className="w-40 h-2.5 bg-slate-200 rounded" />
                </div>
              </div>
              <div className="w-16 h-6 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          ⚠️ {error}
        </div>
      ) : teams.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl space-y-2">
          <p className="text-xs font-semibold text-slate-400">
            Belum ada data regu yang terdaftar di database.
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = '/manajemen/regu')}
            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition"
          >
            + Kelola & Tambah Regu
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          {teams.slice(0, 5).map((item, idx) => {
            const rank = idx + 1;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedTeam({ team: item, rank })}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                  rank === 1
                    ? 'bg-gradient-to-r from-amber-50/60 to-white border-amber-200 hover:border-amber-300 shadow-sm'
                    : 'bg-slate-50 border-slate-200/60 hover:border-indigo-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-sm ${getBadgeStyle(
                      rank
                    )}`}
                  >
                    {rank === 1 ? <TrophyFilled /> : `#${rank}`}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                      <span className="text-[9px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                        {item.gender || 'Penggalang'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {item.memberCount} Anggota • Hadir +{item.attendancePoints}
                      {item.bonusPoints !== 0 && (
                        <span className="text-amber-600 font-semibold">
                          {' '}
                          • Game {item.bonusPoints > 0 ? `+${item.bonusPoints}` : item.bonusPoints}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Total Poin + Tombol Detail */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 flex items-center gap-1">
                    <StarFilled className="text-amber-500 text-[10px]" /> {item.totalScore} Poin
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTeam({ team: item, rank });
                    }}
                    className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
                  >
                    <EyeOutlined /> Detail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tombol Aksi ke Halaman Ranking Lengkap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => (window.location.href = '/ranking')}
          className="w-full text-center py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition border border-dashed border-indigo-200 block"
        >
          🏆 Lihat Klasemen & Detail Ranking →
        </button>
        <button
          type="button"
          onClick={() => (window.location.href = '/manajemen/regu')}
          className="w-full text-center py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition border border-dashed border-slate-300 block"
        >
          🚩 Kelola Daftar Regu →
        </button>
      </div>

      {/* Modal Detail Skor Regu */}
      <ScoreDetailModal
        open={!!selectedTeam}
        onClose={() => setSelectedTeam(null)}
        type="team"
        rank={selectedTeam?.rank}
        teamData={selectedTeam?.team}
        onRefresh={fetchLeaderboard}
        onOpenAddScore={() => {
          const teamId = selectedTeam?.team.id;
          setSelectedTeam(null);
          setDefaultTeamIdForModal(teamId);
          setShowScoreModal(true);
        }}
      />

      {/* Modal Input Skor Minigame */}
      <MinigameScoreModal
        open={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        defaultTargetType="team"
        defaultTeamId={defaultTeamIdForModal}
        teams={teams}
        students={students}
        onSuccess={fetchLeaderboard}
      />
    </div>
  );
}
