'use client';

import React, { useEffect, useState } from 'react';
import {
  App,
  Table,
  Card,
  Button,
  Tag,
  Modal,
  Input,
  Select,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  TeamOutlined,
  TrophyFilled,
  ReloadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService } from '@/lib/auth';
import {
  getBestTeams,
  getBestStudents,
  createTeam,
  updateTeam,
  deleteTeam,
  assignStudentToTeam,
  BestTeamResult,
  BestStudentResult,
} from '@/services/scoreService';
import ScoreDetailModal from '@/components/ranking/ScoreDetailModal';
import MinigameScoreModal from '@/components/ranking/MinigameScoreModal';

export default function ManajemenReguPage() {
  const { message } = App.useApp();
  const [teams, setTeams] = useState<BestTeamResult[]>([]);
  const [students, setStudents] = useState<BestStudentResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form Tambah Regu Baru
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [newTeamGender, setNewTeamGender] = useState<string>('Putra');
  const [creating, setCreating] = useState<boolean>(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<string>('ALL');

  // Modal Edit Regu
  const [editingTeam, setEditingTeam] = useState<BestTeamResult | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editGender, setEditGender] = useState<string>('Campuran');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Modal Kelola Anggota Regu
  const [managingTeam, setManagingTeam] = useState<BestTeamResult | null>(null);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<string | undefined>();
  const [assigning, setAssigning] = useState<boolean>(false);

  // Modal Detail Skor & Input Skor Minigame
  const [detailTeam, setDetailTeam] = useState<{
    team: BestTeamResult;
    rank: number;
  } | null>(null);
  const [scoreModalTeamId, setScoreModalTeamId] = useState<string | undefined>();
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsData, studentsData] = await Promise.all([
        getBestTeams(),
        getBestStudents(),
      ]);
      setTeams(teamsData);
      setStudents(studentsData);

      if (managingTeam) {
        const updated = teamsData.find((t) => t.id === managingTeam.id);
        if (updated) setManagingTeam(updated);
      }
      if (detailTeam) {
        const updated = teamsData.find((t) => t.id === detailTeam.team.id);
        const rank = teamsData.findIndex((t) => t.id === detailTeam.team.id) + 1;
        if (updated) setDetailTeam({ team: updated, rank });
      }
    } catch (err: any) {
      message.error(err.message || 'Gagal memuat data regu');
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
      if (user.school && !user.school.subscription_active) {
        window.location.href = '/billing';
        return;
      }
      loadData();
    });
  }, []);

  const handleCreateTeam = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault?.();
    if (!newTeamName.trim()) {
      message.warning('Nama regu tidak boleh kosong');
      return;
    }

    try {
      setCreating(true);
      await createTeam({
        name: newTeamName.trim(),
        gender: newTeamGender,
      });
      message.success(`Regu "${newTeamName.trim()}" berhasil ditambahkan!`);
      setNewTeamName('');
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal menambahkan regu');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    if (!editName.trim()) {
      message.warning('Nama regu tidak boleh kosong');
      return;
    }

    try {
      setSavingEdit(true);
      await updateTeam(editingTeam.id, {
        name: editName.trim(),
        gender: editGender,
      });
      message.success('Data regu berhasil diperbarui!');
      setEditingTeam(null);
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memperbarui regu');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    try {
      await deleteTeam(id);
      message.success('Regu berhasil dihapus');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus regu');
    }
  };

  const handleAssignStudent = async () => {
    if (!managingTeam || !selectedStudentToAdd) {
      message.warning('Pilih siswa yang ingin dimasukkan ke regu ini');
      return;
    }

    try {
      setAssigning(true);
      await assignStudentToTeam(selectedStudentToAdd, managingTeam.id);
      message.success('Siswa berhasil dimasukkan ke regu!');
      setSelectedStudentToAdd(undefined);
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memindahkan siswa');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveStudentFromTeam = async (studentId: string) => {
    try {
      await assignStudentToTeam(studentId, null);
      message.success('Siswa dikeluarkan dari regu');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal mengeluarkan siswa');
    }
  };

  const filteredTeams = teams.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'ALL' || t.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <span className="font-extrabold text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
          #{index + 1}
        </span>
      ),
    },
    {
      title: 'Nama Regu',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => (
        <span className="font-bold text-slate-900 text-sm">{val}</span>
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
      title: 'Anggota',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 110,
      align: 'center' as const,
      render: (val: number, record: BestTeamResult) => (
        <button
          type="button"
          onClick={() => setManagingTeam(record)}
          className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-xl transition inline-flex items-center gap-1"
        >
          <TeamOutlined /> {val} Siswa
        </button>
      ),
    },
    {
      title: 'Poin Kehadiran',
      dataIndex: 'attendancePoints',
      key: 'attendancePoints',
      width: 130,
      align: 'center' as const,
      render: (val: number, record: BestTeamResult) => (
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
          +{val} ({record.totalAttendanceCount}x)
        </span>
      ),
    },
    {
      title: 'Poin Minigame',
      dataIndex: 'bonusPoints',
      key: 'bonusPoints',
      width: 120,
      align: 'center' as const,
      render: (val: number) => (
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
            val >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {val >= 0 ? `+${val}` : val} Poin
        </span>
      ),
    },
    {
      title: 'Total Skor',
      dataIndex: 'totalScore',
      key: 'totalScore',
      width: 120,
      align: 'center' as const,
      render: (val: number) => (
        <span className="text-xs font-black bg-indigo-600 text-white px-3 py-1 rounded-xl shadow-sm">
          {val} Poin
        </span>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 240,
      align: 'center' as const,
      render: (_: any, record: BestTeamResult, index: number) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailTeam({ team: record, rank: index + 1 })}
            className="rounded-lg text-xs font-semibold"
          >
            Detail
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setScoreModalTeamId(record.id);
              setShowScoreModal(true);
            }}
            className="bg-amber-500 hover:!bg-amber-600 border-amber-500 rounded-lg text-xs font-semibold"
          >
            + Skor
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingTeam(record);
              setEditName(record.name);
              setEditGender(record.gender || 'Campuran');
            }}
            className="rounded-lg text-xs"
          />
          <Popconfirm
            title={`Hapus regu "${record.name}"?`}
            description="Anggota regu tidak akan terhapus, hanya dilepas dari regu ini."
            onConfirm={() => handleDeleteTeam(record.id)}
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

  if (loading) {
    return <PageLoader text="Memuat Data Regu & Anggota..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Manajemen Regu Pramuka"
          subtitle="Kelola Daftar Regu, Anggota Regu, serta Pantau Skor Kehadiran & Minigames"
        />

        {/* Filter & Tabel Regu */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Daftar Seluruh Regu ({teams.length} Regu)
              </h2>
              <p className="text-xs text-slate-400">
                Klik jumlah siswa pada kolom Anggota untuk menambah atau memindahkan anggota regu.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={loadData}
                className="rounded-xl text-xs font-semibold h-9"
              >
                Segarkan
              </Button>
              <Button
                type="primary"
                icon={<TrophyFilled />}
                onClick={() => (window.location.href = '/ranking')}
                className="bg-amber-500 hover:!bg-amber-600 border-amber-500 rounded-xl text-xs font-bold h-9"
              >
                Lihat Klasemen Lengkap
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:!bg-indigo-700 rounded-xl text-xs font-bold h-9"
              >
                Tambah Regu
              </Button>
            </div>
          </div>

          <Modal
            title={<span className="font-bold text-sm">🚩 Tambah Regu Baru</span>}
            open={showCreateModal}
            onCancel={() => setShowCreateModal(false)}
            onOk={handleCreateTeam}
            confirmLoading={creating}
            okText="Tambah Regu"
            cancelText="Batal"
            centered
          >
            <div className="space-y-4 py-2">
              <p className="text-xs text-slate-400">
                Masukkan nama regu (misal: Regu Elang, Regu Harimau, Regu Melati) dan pilih kategorinya.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Nama Regu
                </label>
                <Input
                  placeholder="Contoh: Regu Rajawali / Regu Edelweis..."
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Kategori Regu
                </label>
                <Select
                  value={newTeamGender}
                  onChange={(val) => setNewTeamGender(val)}
                  className="w-full"
                  options={[
                    { value: 'Putra', label: 'Putra' },
                    { value: 'Putri', label: 'Putri' },
                    { value: 'Campuran', label: 'Campuran' },
                  ]}
                />
              </div>
            </div>
          </Modal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder="Cari nama regu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Kategori ({teams.length} Regu)</option>
              <option value="Putra">Regu Putra</option>
              <option value="Putri">Regu Putri</option>
              <option value="Campuran">Regu Campuran</option>
            </select>
          </div>

          <Card
            className="rounded-2xl shadow-none border border-slate-100 overflow-hidden"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={filteredTeams}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 900 }}
            />
          </Card>
        </div>

        {/* Modal Edit Regu */}
        <Modal
          open={!!editingTeam}
          onCancel={() => setEditingTeam(null)}
          onOk={handleUpdateTeam}
          confirmLoading={savingEdit}
          title="✏️ Edit Data Regu"
          okText="Simpan Perubahan"
          cancelText="Batal"
          centered
        >
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Nama Regu
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nama regu..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Kategori
              </label>
              <Select
                value={editGender}
                onChange={(val) => setEditGender(val)}
                className="w-full"
                options={[
                  { value: 'Putra', label: 'Putra' },
                  { value: 'Putri', label: 'Putri' },
                  { value: 'Campuran', label: 'Campuran' },
                ]}
              />
            </div>
          </div>
        </Modal>

        {/* Modal Kelola Anggota Regu */}
        <Modal
          open={!!managingTeam}
          onCancel={() => setManagingTeam(null)}
          footer={null}
          width={600}
          centered
          title={`👥 Kelola Anggota — ${managingTeam?.name || ''}`}
        >
          {managingTeam && (
            <div className="space-y-4 pt-2 font-sans">
              {/* Tambah/Pindahkan Siswa ke Regu Ini */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">
                  Masukkan Anggota ke {managingTeam.name}
                </label>
                <div className="flex gap-2">
                  <Select
                    showSearch
                    value={selectedStudentToAdd}
                    onChange={(val) => setSelectedStudentToAdd(val)}
                    placeholder="Ketik nama siswa..."
                    optionFilterProp="label"
                    className="flex-1"
                    options={students
                      .filter((s) => s.team_id !== managingTeam.id)
                      .map((s) => ({
                        value: s.id,
                        label: `${s.full_name} (Kelas ${s.class_name} • Saat ini: ${s.group_name})`,
                      }))}
                  />
                  <Button
                    type="primary"
                    loading={assigning}
                    icon={<UserAddOutlined />}
                    onClick={handleAssignStudent}
                    className="bg-indigo-600 hover:!bg-indigo-700 rounded-xl font-bold text-xs"
                  >
                    Masukkan
                  </Button>
                </div>
              </div>

              {/* Daftar Anggota Regu Saat Ini */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-600">
                  Daftar Anggota Saat Ini ({managingTeam.members.length} Siswa)
                </h4>
                {managingTeam.members.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    Belum ada siswa di regu ini.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {managingTeam.members.map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between bg-white border border-slate-200/80 px-3.5 py-2 rounded-xl"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-800">
                            {idx + 1}. {m.full_name}
                          </span>
                          <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            Kelas {m.class_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-emerald-600">
                            {m.presentCount}x Hadir
                          </span>
                          <Popconfirm
                            title="Keluarkan siswa dari regu ini?"
                            onConfirm={() => handleRemoveStudentFromTeam(m.id)}
                            okText="Ya"
                            cancelText="Batal"
                          >
                            <Button size="small" danger className="text-[11px] rounded-lg">
                              Keluarkan
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* Modal Detail Skor Regu */}
        <ScoreDetailModal
          open={!!detailTeam}
          onClose={() => setDetailTeam(null)}
          type="team"
          rank={detailTeam?.rank}
          teamData={detailTeam?.team}
          onRefresh={loadData}
          onOpenAddScore={() => {
            const teamId = detailTeam?.team.id;
            setDetailTeam(null);
            setScoreModalTeamId(teamId);
            setShowScoreModal(true);
          }}
        />

        {/* Modal Input Skor Minigame */}
        <MinigameScoreModal
          open={showScoreModal}
          onClose={() => setShowScoreModal(false)}
          defaultTargetType="team"
          defaultTeamId={scoreModalTeamId}
          teams={teams}
          students={students}
          onSuccess={loadData}
        />
      </div>
    </div>
  );
}
