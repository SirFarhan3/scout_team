'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Modal,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Radio,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TrophyFilled,
  TeamOutlined,
  UserOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  SettingOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import { authService } from '@/lib/auth';
import {
  PointPreset,
  TeamScoreLogItem,
  StudentBonusLogItem,
  BestTeamResult,
  BestStudentResult,
  getPointPresets,
  createPointPreset,
  updatePointPreset,
  deletePointPreset,
  getAllTeamScoreLogs,
  getAllStudentBonusLogs,
  updateTeamScore,
  deleteTeamScore,
  updateStudentBonusPoint,
  deleteStudentBonusPoint,
  getBestTeams,
  getBestStudents,
} from '@/services/scoreService';
import MinigameScoreModal from '@/components/ranking/MinigameScoreModal';

export default function ManajemenPoinPage() {
  const [activeTab, setActiveTab] = useState<'presets' | 'logs'>('presets');
  const [presets, setPresets] = useState<PointPreset[]>([]);
  const [teamLogs, setTeamLogs] = useState<TeamScoreLogItem[]>([]);
  const [studentLogs, setStudentLogs] = useState<StudentBonusLogItem[]>([]);
  const [teams, setTeams] = useState<BestTeamResult[]>([]);
  const [students, setStudents] = useState<BestStudentResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // State Form Tambah Master Poin Baru
  const [newTitle, setNewTitle] = useState<string>('');
  const [newTargetType, setNewTargetType] = useState<'team' | 'student'>('team');
  const [newPointMode, setNewPointMode] = useState<'add' | 'deduct'>('add');
  const [newPointValue, setNewPointValue] = useState<number>(10);
  const [creatingPreset, setCreatingPreset] = useState<boolean>(false);

  // Filter Master Poin
  const [filterTarget, setFilterTarget] = useState<string>('ALL');
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sub-tab untuk Riwayat Log Poin
  const [logSubTab, setLogSubTab] = useState<'team' | 'student'>('team');

  // Modal Edit Master Poin
  const [editingPreset, setEditingPreset] = useState<PointPreset | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editTargetType, setEditTargetType] = useState<'team' | 'student'>('team');
  const [editPointMode, setEditPointMode] = useState<'add' | 'deduct'>('add');
  const [editPointValue, setEditPointValue] = useState<number>(10);
  const [savingPreset, setSavingPreset] = useState<boolean>(false);

  // Modal Edit Riwayat Log Transaksi Poin
  const [editingLog, setEditingLog] = useState<{
    id: string;
    kind: 'team' | 'student';
    name: string;
    description: string;
    points: number;
  } | null>(null);
  const [editLogDesc, setEditLogDesc] = useState<string>('');
  const [editLogMode, setEditLogMode] = useState<'add' | 'deduct'>('add');
  const [editLogVal, setEditLogVal] = useState<number>(10);
  const [savingLog, setSavingLog] = useState<boolean>(false);

  // Modal Beri / Kurangi Poin ke Regu atau Siswa
  const [showGivePointModal, setShowGivePointModal] = useState<boolean>(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [presetsData, tLogs, sLogs, teamsData, studentsData] = await Promise.all([
        getPointPresets(),
        getAllTeamScoreLogs().catch(() => []),
        getAllStudentBonusLogs().catch(() => []),
        getBestTeams().catch(() => []),
        getBestStudents().catch(() => []),
      ]);
      setPresets(presetsData);
      setTeamLogs(tLogs);
      setStudentLogs(sLogs);
      setTeams(teamsData);
      setStudents(studentsData);
    } catch (err: any) {
      message.error(err.message || 'Gagal memuat data manajemen poin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      if (!user) {
        window.location.href = '/login';
        return;
      }
      loadAllData();
    });
  }, []);

  // Tambah Master Poin Baru
  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      message.warning('Nama / deskripsi poin wajib diisi');
      return;
    }
    if (!newPointValue || newPointValue <= 0) {
      message.warning('Nominal poin harus lebih dari 0');
      return;
    }

    const signedPoints =
      newPointMode === 'deduct' ? -Math.abs(newPointValue) : Math.abs(newPointValue);

    try {
      setCreatingPreset(true);
      await createPointPreset({
        title: newTitle.trim(),
        target_type: newTargetType,
        points: signedPoints,
      });
      message.success(
        `Master poin "${newTitle.trim()}" (${
          signedPoints >= 0 ? `+${signedPoints}` : signedPoints
        }) berhasil ditambahkan!`
      );
      setNewTitle('');
      await loadAllData();
    } catch (err: any) {
      message.error(err.message || 'Gagal menyimpan master poin');
    } finally {
      setCreatingPreset(false);
    }
  };

  // Simpan Edit Master Poin
  const handleSavePresetEdit = async () => {
    if (!editingPreset) return;
    if (!editTitle.trim()) {
      message.warning('Nama poin tidak boleh kosong');
      return;
    }

    const signedPoints =
      editPointMode === 'deduct' ? -Math.abs(editPointValue) : Math.abs(editPointValue);

    try {
      setSavingPreset(true);
      await updatePointPreset(editingPreset.id, {
        title: editTitle.trim(),
        target_type: editTargetType,
        points: signedPoints,
      });
      message.success('Master poin berhasil diperbarui!');
      setEditingPreset(null);
      await loadAllData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memperbarui master poin');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await deletePointPreset(id);
      message.success('Master poin berhasil dihapus');
      await loadAllData();
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus master poin');
    }
  };

  // Simpan Edit Riwayat Log Transaksi
  const handleSaveLogEdit = async () => {
    if (!editingLog) return;
    const signedPoints =
      editLogMode === 'deduct' ? -Math.abs(editLogVal) : Math.abs(editLogVal);

    try {
      setSavingLog(true);
      if (editingLog.kind === 'team') {
        await updateTeamScore(editingLog.id, {
          description: editLogDesc.trim(),
          points: signedPoints,
        });
      } else {
        await updateStudentBonusPoint(editingLog.id, {
          description: editLogDesc.trim(),
          points: signedPoints,
        });
      }
      message.success('Catatan poin berhasil diperbarui!');
      setEditingLog(null);
      await loadAllData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memperbarui catatan poin');
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteLog = async (id: string, kind: 'team' | 'student') => {
    try {
      if (kind === 'team') {
        await deleteTeamScore(id);
      } else {
        await deleteStudentBonusPoint(id);
      }
      message.success('Riwayat poin berhasil dihapus');
      await loadAllData();
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus riwayat poin');
    }
  };

  const filteredPresets = presets.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTarget = filterTarget === 'ALL' || p.target_type === filterTarget;
    const matchesKind =
      filterKind === 'ALL' ||
      (filterKind === 'ADD' && p.points >= 0) ||
      (filterKind === 'DEDUCT' && p.points < 0);
    return matchesSearch && matchesTarget && matchesKind;
  });

  const presetColumns = [
    {
      title: 'No',
      key: 'no',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <span className="text-xs font-bold text-slate-500">{index + 1}</span>
      ),
    },
    {
      title: 'Nama Penilaian / Minigame / Pelanggaran',
      dataIndex: 'title',
      key: 'title',
      render: (val: string) => (
        <span className="text-xs sm:text-sm font-bold text-slate-800">{val}</span>
      ),
    },
    {
      title: 'Target',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 130,
      align: 'center' as const,
      render: (val: string) =>
        val === 'team' ? (
          <Tag color="geekblue" className="rounded-full font-bold text-xs px-2.5">
            🚩 Regu
          </Tag>
        ) : (
          <Tag color="cyan" className="rounded-full font-bold text-xs px-2.5">
            👤 Individu
          </Tag>
        ),
    },
    {
      title: 'Jenis',
      key: 'kind',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: PointPreset) =>
        record.points >= 0 ? (
          <Tag color="green" className="rounded-full font-bold text-xs px-2.5">
            ➕ Penambahan
          </Tag>
        ) : (
          <Tag color="volcano" className="rounded-full font-bold text-xs px-2.5">
            ➖ Pengurangan
          </Tag>
        ),
    },
    {
      title: 'Nominal Poin',
      dataIndex: 'points',
      key: 'points',
      width: 130,
      align: 'center' as const,
      render: (val: number) => (
        <span
          className={`text-xs font-black px-3 py-1 rounded-xl ${
            val >= 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700'
          }`}
        >
          {val >= 0 ? `+${val}` : val} Poin
        </span>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: PointPreset) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPreset(record);
              setEditTitle(record.title);
              setEditTargetType(record.target_type);
              setEditPointMode(record.points < 0 ? 'deduct' : 'add');
              setEditPointValue(Math.abs(record.points));
            }}
            className="rounded-lg text-xs"
          />
          <Popconfirm
            title={`Hapus item poin "${record.title}"?`}
            onConfirm={() => handleDeletePreset(record.id)}
            okText="Ya, Hapus"
            cancelText="Batal"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="rounded-lg text-xs"
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const teamLogColumns = [
    {
      title: 'Waktu',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (val: string) => (
        <span className="text-xs text-slate-500">
          {new Date(val).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      title: 'Nama Regu',
      dataIndex: 'team_name',
      key: 'team_name',
      width: 160,
      render: (val: string, record: TeamScoreLogItem) => (
        <div>
          <span className="font-bold text-slate-900 text-xs">{val}</span>
          {record.team_gender && (
            <span className="ml-1.5 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-semibold">
              {record.team_gender}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Keterangan Penilaian / Minigame / Evaluasi',
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => <span className="text-xs font-semibold text-slate-700">{val}</span>,
    },
    {
      title: 'Poin',
      dataIndex: 'points',
      key: 'points',
      width: 120,
      align: 'center' as const,
      render: (val: number) => (
        <span
          className={`text-xs font-black px-2.5 py-1 rounded-xl ${
            val >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {val >= 0 ? `+${val}` : val} Poin
        </span>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: TeamScoreLogItem) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingLog({
                id: record.id,
                kind: 'team',
                name: record.team_name,
                description: record.description,
                points: record.points,
              });
              setEditLogDesc(record.description);
              setEditLogMode(record.points < 0 ? 'deduct' : 'add');
              setEditLogVal(Math.abs(record.points));
            }}
            className="rounded-lg text-xs"
          />
          <Popconfirm
            title="Hapus catatan poin ini?"
            onConfirm={() => handleDeleteLog(record.id, 'team')}
            okText="Hapus"
            cancelText="Batal"
          >
            <Button size="small" danger icon={<DeleteOutlined />} className="rounded-lg text-xs" />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const studentLogColumns = [
    {
      title: 'Waktu',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (val: string) => (
        <span className="text-xs text-slate-500">
          {new Date(val).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      title: 'Nama Siswa',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 200,
      render: (val: string, record: StudentBonusLogItem) => (
        <div>
          <span className="font-bold text-slate-900 text-xs">{val}</span>
          <div className="text-[10px] text-slate-400">
            Kelas {record.class_name} • {record.group_name}
          </div>
        </div>
      ),
    },
    {
      title: 'Keterangan Keaktifan / Minigame / Evaluasi',
      dataIndex: 'description',
      key: 'description',
      render: (val: string) => <span className="text-xs font-semibold text-slate-700">{val}</span>,
    },
    {
      title: 'Poin',
      dataIndex: 'points',
      key: 'points',
      width: 120,
      align: 'center' as const,
      render: (val: number) => (
        <span
          className={`text-xs font-black px-2.5 py-1 rounded-xl ${
            val >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {val >= 0 ? `+${val}` : val} Poin
        </span>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: StudentBonusLogItem) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingLog({
                id: record.id,
                kind: 'student',
                name: record.student_name,
                description: record.description,
                points: record.points,
              });
              setEditLogDesc(record.description);
              setEditLogMode(record.points < 0 ? 'deduct' : 'add');
              setEditLogVal(Math.abs(record.points));
            }}
            className="rounded-lg text-xs"
          />
          <Popconfirm
            title="Hapus catatan poin ini?"
            onConfirm={() => handleDeleteLog(record.id, 'student')}
            okText="Hapus"
            cancelText="Batal"
          >
            <Button size="small" danger icon={<DeleteOutlined />} className="rounded-lg text-xs" />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Manajemen Poin Ranking & Keaktifan"
          subtitle="Kelola Master Katalog Poin (+ Penambahan & - Pengurangan) serta Riwayat Transaksi Poin di Database"
        />

        {/* Top Action & Tab Switcher */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                activeTab === 'presets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SettingOutlined /> Master Katalog Poin ({presets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                activeTab === 'logs'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HistoryOutlined /> Riwayat Transaksi Poin (
              {teamLogs.length + studentLogs.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={loadAllData}
              className="flex-1 sm:flex-initial rounded-2xl h-10 px-4 text-xs font-semibold"
            >
              Segarkan
            </Button>
            <Button
              icon={<TrophyFilled />}
              onClick={() => (window.location.href = '/ranking')}
              className="flex-1 sm:flex-initial rounded-2xl h-10 px-4 text-xs font-bold text-indigo-600 border-indigo-200"
            >
              Lihat Ranking
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowGivePointModal(true)}
              className="w-full sm:w-auto bg-amber-500 hover:!bg-amber-600 border-amber-500 rounded-2xl h-10 px-5 text-xs font-extrabold shadow-md shadow-amber-200/60"
            >
              ⚡ Beri / Kurangi Poin Sekarang
            </Button>
          </div>
        </div>

        {activeTab === 'presets' ? (
          <>
            {/* 1. Form Tambah Master Poin ke Database */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ➕ Tambah Item Katalog Poin Baru ke Database
                </h2>
                <p className="text-xs text-slate-400">
                  Item poin yang ditambahkan di sini akan otomatis muncul sebagai pilihan saat Pembina menambah atau mengurangi poin Regu maupun Siswa.
                </p>
              </div>

              <form
                onSubmit={handleCreatePreset}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                {/* Target: Regu vs Individu */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Target Poin
                  </label>
                  <select
                    value={newTargetType}
                    onChange={(e) => setNewTargetType(e.target.value as 'team' | 'student')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="team">🚩 Regu</option>
                    <option value="student">👤 Individu Siswa</option>
                  </select>
                </div>

                {/* Jenis: Penambahan (+) vs Pengurangan (-) */}
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Jenis Poin
                  </label>
                  <select
                    value={newPointMode}
                    onChange={(e) => setNewPointMode(e.target.value as 'add' | 'deduct')}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 ${
                      newPointMode === 'add'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 focus:ring-emerald-500'
                        : 'bg-rose-50 border-rose-200 text-rose-800 focus:ring-rose-500'
                    }`}
                  >
                    <option value="add">➕ Penambahan Poin (+ Reward)</option>
                    <option value="deduct">➖ Pengurangan Poin (- Sanksi)</option>
                  </select>
                </div>

                {/* Nama Penilaian / Pelanggaran */}
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Nama Penilaian / Minigame / Pelanggaran *
                  </label>
                  <input
                    type="text"
                    placeholder={
                      newPointMode === 'add'
                        ? 'Contoh: Juara 1 Lomba Pionering / Menjawab Kuis'
                        : 'Contoh: Atribut Tidak Lengkap / Terlambat Apel'
                    }
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Nominal Poin */}
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Poin ({newPointMode === 'add' ? '+' : '-'})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={newPointValue}
                    onChange={(e) => setNewPointValue(Math.max(1, Math.abs(Number(e.target.value) || 0)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Submit Button */}
                <div className="md:col-span-2">
                  <Button
                    htmlType="submit"
                    type="primary"
                    loading={creatingPreset}
                    icon={<PlusOutlined />}
                    className="w-full h-10 rounded-xl font-bold text-xs bg-indigo-600 hover:!bg-indigo-700"
                  >
                    Simpan Poin
                  </Button>
                </div>
              </form>
            </div>

            {/* 2. Tabel Daftar Master Poin di Database */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Cari nama item poin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={filterTarget}
                  onChange={(e) => setFilterTarget(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Target (Regu & Individu)</option>
                  <option value="team">🚩 Khusus Poin Regu</option>
                  <option value="student">👤 Khusus Poin Individu</option>
                </select>
                <select
                  value={filterKind}
                  onChange={(e) => setFilterKind(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Jenis (+ Penambahan & - Pengurangan)</option>
                  <option value="ADD">➕ Hanya Penambahan Poin (+)</option>
                  <option value="DEDUCT">➖ Hanya Pengurangan Poin (-)</option>
                </select>
              </div>

              <Card
                className="rounded-2xl shadow-none border border-slate-100 overflow-hidden"
                styles={{ body: { padding: 0 } }}
              >
                <Table
                  dataSource={filteredPresets}
                  columns={presetColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 750 }}
                />
              </Card>
            </div>
          </>
        ) : (
          /* TAB 2: RIWAYAT TRANSAKSI POIN REGU & INDIVIDU */
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  📜 Riwayat Transaksi Penambahan & Pengurangan Poin
                </h2>
                <p className="text-xs text-slate-400">
                  Anda dapat mengubah nominal poin (+/-) atau menghapus catatan poin yang pernah diberikan.
                </p>
              </div>

              <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setLogSubTab('team')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    logSubTab === 'team'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  🚩 Riwayat Poin Regu ({teamLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogSubTab('student')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    logSubTab === 'student'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  👤 Riwayat Poin Siswa ({studentLogs.length})
                </button>
              </div>
            </div>

            <Card
              className="rounded-2xl shadow-none border border-slate-100 overflow-hidden"
              styles={{ body: { padding: 0 } }}
            >
              {logSubTab === 'team' ? (
                <Table
                  dataSource={teamLogs}
                  columns={teamLogColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 750 }}
                />
              ) : (
                <Table
                  dataSource={studentLogs}
                  columns={studentLogColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 750 }}
                />
              )}
            </Card>
          </div>
        )}

        {/* Modal Edit Master Poin */}
        <Modal
          open={!!editingPreset}
          onCancel={() => setEditingPreset(null)}
          onOk={handleSavePresetEdit}
          confirmLoading={savingPreset}
          title="✏️ Edit Item Master Poin"
          okText="Simpan Perubahan"
          cancelText="Batal"
          centered
        >
          <div className="space-y-4 pt-2 font-sans">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Target Poin
              </label>
              <Radio.Group
                value={editTargetType}
                onChange={(e) => setEditTargetType(e.target.value)}
              >
                <Radio value="team">🚩 Regu</Radio>
                <Radio value="student">👤 Individu Siswa</Radio>
              </Radio.Group>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Jenis Aksi Poin
              </label>
              <Radio.Group
                value={editPointMode}
                onChange={(e) => setEditPointMode(e.target.value)}
              >
                <Radio value="add" className="text-emerald-700 font-semibold">
                  ➕ Penambahan (+)
                </Radio>
                <Radio value="deduct" className="text-rose-700 font-semibold">
                  ➖ Pengurangan (-)
                </Radio>
              </Radio.Group>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Nama Penilaian / Pelanggaran
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Nama penilaian..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Nominal Poin ({editPointMode === 'add' ? '+' : '-'})
              </label>
              <InputNumber
                value={editPointValue}
                onChange={(val) => setEditPointValue(Math.max(1, Math.abs(Number(val) || 0)))}
                min={1}
                max={500}
                className="w-full"
              />
            </div>
          </div>
        </Modal>

        {/* Modal Edit Riwayat Transaksi Poin */}
        <Modal
          open={!!editingLog}
          onCancel={() => setEditingLog(null)}
          onOk={handleSaveLogEdit}
          confirmLoading={savingLog}
          title={`✏️ Edit Catatan Poin — ${editingLog?.name || ''}`}
          okText="Simpan Perubahan"
          cancelText="Batal"
          centered
        >
          <div className="space-y-4 pt-2 font-sans">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Jenis Poin
              </label>
              <Radio.Group
                value={editLogMode}
                onChange={(e) => setEditLogMode(e.target.value)}
              >
                <Radio value="add" className="text-emerald-700 font-semibold">
                  ➕ Penambahan (+)
                </Radio>
                <Radio value="deduct" className="text-rose-700 font-semibold">
                  ➖ Pengurangan (-)
                </Radio>
              </Radio.Group>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Keterangan Penilaian / Evaluasi
              </label>
              <Input
                value={editLogDesc}
                onChange={(e) => setEditLogDesc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Nominal Poin ({editLogMode === 'add' ? '+' : '-'})
              </label>
              <InputNumber
                value={editLogVal}
                onChange={(val) => setEditLogVal(Math.max(1, Math.abs(Number(val) || 0)))}
                min={1}
                max={500}
                className="w-full"
              />
            </div>
          </div>
        </Modal>

        {/* Modal Beri / Kurangi Poin */}
        <MinigameScoreModal
          open={showGivePointModal}
          onClose={() => setShowGivePointModal(false)}
          teams={teams}
          students={students}
          onSuccess={loadAllData}
        />
      </div>
    </div>
  );
}
