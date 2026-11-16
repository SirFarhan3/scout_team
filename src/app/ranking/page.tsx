'use client';

import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Tag, message } from 'antd';
import {
  TrophyFilled,
  CrownFilled,
  StarFilled,
  ThunderboltFilled,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import {
  getBestTeams,
  getBestStudents,
  BestTeamResult,
  BestStudentResult,
} from '@/services/scoreService';
import ScoreDetailModal from '@/components/ranking/ScoreDetailModal';
import MinigameScoreModal from '@/components/ranking/MinigameScoreModal';

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState<'team' | 'student'>('team');
  const [teams, setTeams] = useState<BestTeamResult[]>([]);
  const [students, setStudents] = useState<BestStudentResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('ALL');

  // Modal Detail State
  const [detailModal, setDetailModal] = useState<{
    type: 'team' | 'student';
    rank: number;
    team?: BestTeamResult;
    student?: BestStudentResult;
  } | null>(null);

  // Modal Input Skor Minigame / Keaktifan
  const [scoreModalConfig, setScoreModalConfig] = useState<{
    open: boolean;
    targetType: 'team' | 'student';
    teamId?: string;
    studentId?: string;
  }>({
    open: false,
    targetType: 'team',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'student') {
        setActiveTab('student');
      }
    }
    loadAllRankings();
  }, []);

  const loadAllRankings = async () => {
    try {
      setLoading(true);
      const [teamsData, studentsData] = await Promise.all([
        getBestTeams(),
        getBestStudents(),
      ]);
      setTeams(teamsData);
      setStudents(studentsData);

      // Sinkronkan data pada modal detail jika sedang terbuka
      if (detailModal) {
        if (detailModal.type === 'team' && detailModal.team) {
          const updated = teamsData.find((t) => t.id === detailModal.team?.id);
          const newRank = teamsData.findIndex((t) => t.id === detailModal.team?.id) + 1;
          if (updated) {
            setDetailModal({ type: 'team', rank: newRank, team: updated });
          }
        } else if (detailModal.type === 'student' && detailModal.student) {
          const updated = studentsData.find((s) => s.id === detailModal.student?.id);
          const newRank =
            studentsData.findIndex((s) => s.id === detailModal.student?.id) + 1;
          if (updated) {
            setDetailModal({ type: 'student', rank: newRank, student: updated });
          }
        }
      }
    } catch (err: any) {
      message.error(err.message || 'Gagal memuat data klasemen ranking');
    } finally {
      setLoading(false);
    }
  };

  // Pilihan filter dinamis
  const classOptions = Array.from(new Set(students.map((s) => s.class_name)))
    .filter(Boolean)
    .sort();
  const teamNameOptions = Array.from(new Set(students.map((s) => s.group_name)))
    .filter(Boolean)
    .sort();

  // Filter Regu
  const filteredTeams = teams.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender =
      selectedGenderFilter === 'ALL' || t.gender === selectedGenderFilter;
    return matchesSearch && matchesGender;
  });

  // Filter Siswa
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.full_name.toLowerCase().includes(q) ||
      s.group_name.toLowerCase().includes(q) ||
      (s.nta && s.nta.toLowerCase().includes(q));
    const matchesClass = selectedClass === 'ALL' || s.class_name === selectedClass;
    const matchesTeam =
      selectedTeamFilter === 'ALL' || s.group_name === selectedTeamFilter;
    return matchesSearch && matchesClass && matchesTeam;
  });

  // Kolom Tabel Ranking Regu
  const teamColumns = [
    {
      title: 'Peringkat',
      key: 'rank',
      width: 90,
      align: 'center' as const,
      render: (_: any, record: BestTeamResult) => {
        const globalRank = teams.findIndex((t) => t.id === record.id) + 1;
        const badgeClass =
          globalRank === 1
            ? 'bg-amber-500 text-white shadow-sm'
            : globalRank === 2
            ? 'bg-slate-300 text-slate-800'
            : globalRank === 3
            ? 'bg-amber-700 text-white'
            : 'bg-slate-100 text-slate-600';
        return (
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-extrabold text-xs ${badgeClass}`}
          >
            {globalRank === 1 ? <TrophyFilled /> : `#${globalRank}`}
          </span>
        );
      },
    },
    {
      title: 'Nama Regu',
      dataIndex: 'name',
      key: 'name',
      render: (val: string, record: BestTeamResult) => (
        <div>
          <span className="font-extrabold text-slate-900 text-sm">{val}</span>
          <div className="text-[11px] text-slate-400">
            {record.memberCount} Anggota Terdaftar
          </div>
        </div>
      ),
    },
    {
      title: 'Kategori',
      dataIndex: 'gender',
      key: 'gender',
      width: 110,
      align: 'center' as const,
      render: (val: string) => {
        const color =
          val === 'Putra' ? 'blue' : val === 'Putri' ? 'magenta' : 'purple';
        return (
          <Tag color={color} className="font-bold text-xs rounded-full px-2.5">
            {val || 'Campuran'}
          </Tag>
        );
      },
    },
    {
      title: 'Poin Kehadiran QR',
      dataIndex: 'attendancePoints',
      key: 'attendancePoints',
      width: 150,
      align: 'center' as const,
      render: (val: number, record: BestTeamResult) => (
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
          +{val} Poin ({record.totalAttendanceCount}x)
        </span>
      ),
    },
    {
      title: 'Skor Minigames / Bonus',
      dataIndex: 'bonusPoints',
      key: 'bonusPoints',
      width: 150,
      align: 'center' as const,
      render: (val: number, record: BestTeamResult) => (
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
            val >= 0
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {val >= 0 ? `+${val}` : val} Poin ({record.scoreHistory.length}x)
        </span>
      ),
    },
    {
      title: 'Total Skor Regu',
      dataIndex: 'totalScore',
      key: 'totalScore',
      width: 140,
      align: 'center' as const,
      render: (val: number) => (
        <span className="text-xs font-black bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl shadow-sm inline-flex items-center gap-1">
          <StarFilled className="text-amber-300 text-[10px]" /> {val} Poin
        </span>
      ),
    },
    {
      title: 'Aksi & Detail',
      key: 'actions',
      width: 210,
      align: 'center' as const,
      render: (_: any, record: BestTeamResult) => {
        const globalRank = teams.findIndex((t) => t.id === record.id) + 1;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setDetailModal({ type: 'team', rank: globalRank, team: record });
              }}
              className="rounded-xl text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              Detail Skor
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setScoreModalConfig({
                  open: true,
                  targetType: 'team',
                  teamId: record.id,
                });
              }}
              className="bg-amber-500 hover:!bg-amber-600 border-amber-500 rounded-xl text-xs font-bold"
            >
              Game
            </Button>
          </div>
        );
      },
    },
  ];

  // Kolom Tabel Ranking Individu (Siswa)
  const studentColumns = [
    {
      title: 'Peringkat',
      key: 'rank',
      width: 90,
      align: 'center' as const,
      render: (_: any, record: BestStudentResult) => {
        const globalRank = students.findIndex((s) => s.id === record.id) + 1;
        const badgeClass =
          globalRank === 1
            ? 'bg-emerald-600 text-white shadow-sm'
            : globalRank === 2
            ? 'bg-indigo-600 text-white'
            : globalRank === 3
            ? 'bg-amber-600 text-white'
            : 'bg-slate-100 text-slate-600';
        return (
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-extrabold text-xs ${badgeClass}`}
          >
            {globalRank === 1 ? <CrownFilled /> : `#${globalRank}`}
          </span>
        );
      },
    },
    {
      title: 'Nama Siswa',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (val: string, record: BestStudentResult) => (
        <div>
          <span className="font-bold text-slate-900 text-xs sm:text-sm">{val}</span>
          <div className="text-[11px] text-slate-400">
            Kelas {record.class_name} • {record.group_name}
          </div>
        </div>
      ),
    },
    {
      title: 'Nilai Keaktifan (Max 100)',
      dataIndex: 'activeScore',
      key: 'activeScore',
      width: 170,
      align: 'center' as const,
      render: (val: number, record: BestStudentResult) => (
        <div>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
            {val} / 100
          </span>
          {/* <div className="text-[10px] text-slate-400 mt-0.5">
            Base {record.baseScore}{' '}
            {record.totalBonusPoints >= 0
              ? `+ Bonus ${record.totalBonusPoints}`
              : `- ${Math.abs(record.totalBonusPoints)}`}
          </div> */}
        </div>
      ),
    },
    {
      title: 'Poin Kehadiran',
      dataIndex: 'attendancePoints',
      key: 'attendancePoints',
      width: 130,
      align: 'center' as const,
      render: (val: number, record: BestStudentResult) => (
        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
          +{val} ({record.presentCount}x Hadir)
        </span>
      ),
    },
    {
      title: 'Bonus Minigame',
      dataIndex: 'totalBonusPoints',
      key: 'totalBonusPoints',
      width: 130,
      align: 'center' as const,
      render: (val: number, record: BestStudentResult) => (
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
            val >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {val >= 0 ? `+${val}` : val} ({record.bonusHistory.length}x)
        </span>
      ),
    },
    {
      title: 'Total Skor Ranking',
      dataIndex: 'totalRankingScore',
      key: 'totalRankingScore',
      width: 140,
      align: 'center' as const,
      render: (val: number) => (
        <span className="text-xs font-black bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-sm inline-flex items-center gap-1">
          <ThunderboltFilled className="text-amber-300 text-[10px]" /> {val} Poin
        </span>
      ),
    },
    {
      title: 'Aksi & Detail',
      key: 'actions',
      width: 210,
      align: 'center' as const,
      render: (_: any, record: BestStudentResult) => {
        const globalRank = students.findIndex((s) => s.id === record.id) + 1;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setDetailModal({ type: 'student', rank: globalRank, student: record });
              }}
              className="rounded-xl text-xs font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              Detail Skor
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setScoreModalConfig({
                  open: true,
                  targetType: 'student',
                  studentId: record.id,
                });
              }}
              className="bg-indigo-600 hover:!bg-indigo-700 rounded-xl text-xs font-bold"
            >
              Poin
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Klasemen Ranking & Skor Minigames"
          subtitle="Leaderboard Real-Time Regu Terbaik & Siswa Teraktif beserta Rincian Sumber Nilai"
        />

        {/* 1. Navigation & Action Bar */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('team');
                setSearchQuery('');
              }}
              className={`py-2.5 px-5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                activeTab === 'team'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TeamOutlined /> Klasemen Regu ({teams.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('student');
                setSearchQuery('');
              }}
              className={`py-2.5 px-5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                activeTab === 'student'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserOutlined /> Klasemen Siswa ({students.length})
            </button>
          </div>

          {/* Tombol Aksi */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={loadAllRankings}
              className="rounded-2xl h-10 px-4 text-xs font-semibold"
            >
              Segarkan
            </Button>
            <Button
              icon={<FlagOutlined />}
              onClick={() => (window.location.href = '/manajemen/regu')}
              className="rounded-2xl h-10 px-4 text-xs font-bold text-slate-700"
            >
              Kelola Regu
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() =>
                setScoreModalConfig({
                  open: true,
                  targetType: activeTab,
                  teamId: teams[0]?.id,
                  studentId: students[0]?.id,
                })
              }
              className="bg-amber-500 hover:!bg-amber-600 border-amber-500 rounded-2xl h-10 px-5 text-xs font-extrabold shadow-md shadow-amber-200/60"
            >
              🎮 Input Skor Minigames / Keaktifan
            </Button>
          </div>
        </div>

        {/* 2. Podium Top 3 Visual Cards */}
        {activeTab === 'team' && teams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.slice(0, 3).map((t, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={t.id}
                  onClick={() => setDetailModal({ type: 'team', rank, team: t })}
                  className={`p-5 rounded-3xl border cursor-pointer transition hover:shadow-md flex flex-col justify-between gap-3 ${
                    rank === 1
                      ? 'bg-gradient-to-br from-amber-50 via-white to-amber-50/30 border-amber-300'
                      : 'bg-white border-slate-200/80 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        rank === 1
                          ? 'bg-amber-500 text-white'
                          : rank === 2
                          ? 'bg-slate-300 text-slate-800'
                          : 'bg-amber-700 text-white'
                      }`}
                    >
                      🏆 Juara #{rank}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
                      {t.gender || 'Campuran'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{t.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.memberCount} Anggota • Hadir +{t.attendancePoints} • Minigame{' '}
                      {t.bonusPoints >= 0 ? `+${t.bonusPoints}` : t.bonusPoints}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-lg font-black text-indigo-600">
                      {t.totalScore} <span className="text-xs font-semibold">Poin</span>
                    </span>
                    <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                      <EyeOutlined /> Klik Detail Nilai →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'student' && students.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {students.slice(0, 3).map((s, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={s.id}
                  onClick={() => setDetailModal({ type: 'student', rank, student: s })}
                  className={`p-5 rounded-3xl border cursor-pointer transition hover:shadow-md flex flex-col justify-between gap-3 ${
                    rank === 1
                      ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-emerald-300'
                      : 'bg-white border-slate-200/80 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        rank === 1
                          ? 'bg-emerald-600 text-white'
                          : rank === 2
                          ? 'bg-indigo-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      🌟 Peringkat #{rank}
                    </span>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                      Kelas {s.class_name} • {s.group_name}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {s.full_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nilai Keaktifan: <strong>{s.activeScore}/100</strong> • Hadir +{s.attendancePoints}{' '}
                      • Bonus {s.totalBonusPoints >= 0 ? `+${s.totalBonusPoints}` : s.totalBonusPoints}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-lg font-black text-emerald-700">
                      {s.totalRankingScore}{' '}
                      <span className="text-xs font-semibold">Poin</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <EyeOutlined /> Klik Detail Nilai →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. Filter & Tabel Lengkap */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeTab === 'team'
                  ? 'Tabel Keseluruhan Peringkat Regu'
                  : 'Tabel Keseluruhan Peringkat & Keaktifan Individu'}
              </h2>
              <p className="text-xs text-slate-400">
                Klik pada baris mana saja atau tombol <strong>Detail Skor</strong> untuk melihat asal-usul perolehan nilai secara lengkap.
              </p>
            </div>
          </div>

          {/* Baris Filter */}
          {activeTab === 'team' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Cari nama regu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={selectedGenderFilter}
                onChange={(e) => setSelectedGenderFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Semua Kategori Regu</option>
                <option value="Putra">Regu Putra</option>
                <option value="Putri">Regu Putri</option>
                <option value="Campuran">Regu Campuran</option>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Cari nama siswa, regu, atau NTA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Kelas</option>
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Regu</option>
                {teamNameOptions.map((regu) => (
                  <option key={regu} value={regu}>
                    {regu}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tabel Ant Design */}
          <Card
            className="rounded-2xl shadow-none border border-slate-100 overflow-hidden"
            styles={{ body: { padding: 0 } }}
          >
            {activeTab === 'team' ? (
              <Table
                dataSource={filteredTeams}
                columns={teamColumns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 850 }}
                onRow={(record) => ({
                  onClick: () => {
                    const globalRank = teams.findIndex((t) => t.id === record.id) + 1;
                    setDetailModal({ type: 'team', rank: globalRank, team: record });
                  },
                  style: { cursor: 'pointer' },
                })}
              />
            ) : (
              <Table
                dataSource={filteredStudents}
                columns={studentColumns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 900 }}
                onRow={(record) => ({
                  onClick: () => {
                    const globalRank = students.findIndex((s) => s.id === record.id) + 1;
                    setDetailModal({
                      type: 'student',
                      rank: globalRank,
                      student: record,
                    });
                  },
                  style: { cursor: 'pointer' },
                })}
              />
            )}
          </Card>
        </div>

        {/* Modal Detail Skor (Muncul ketika baris atau tombol Detail dipencet) */}
        <ScoreDetailModal
          open={!!detailModal}
          onClose={() => setDetailModal(null)}
          type={detailModal?.type || 'team'}
          rank={detailModal?.rank}
          teamData={detailModal?.team}
          studentData={detailModal?.student}
          onRefresh={loadAllRankings}
          onOpenAddScore={() => {
            if (!detailModal) return;
            const isTeam = detailModal.type === 'team';
            const tId = detailModal.team?.id;
            const sId = detailModal.student?.id;
            setDetailModal(null);
            setScoreModalConfig({
              open: true,
              targetType: isTeam ? 'team' : 'student',
              teamId: tId,
              studentId: sId,
            });
          }}
        />

        {/* Modal Input Skor Minigames / Keaktifan */}
        <MinigameScoreModal
          open={scoreModalConfig.open}
          onClose={() => setScoreModalConfig((prev) => ({ ...prev, open: false }))}
          defaultTargetType={scoreModalConfig.targetType}
          defaultTeamId={scoreModalConfig.teamId}
          defaultStudentId={scoreModalConfig.studentId}
          teams={teams}
          students={students}
          onSuccess={loadAllRankings}
        />
      </div>
    </div>
  );
}
