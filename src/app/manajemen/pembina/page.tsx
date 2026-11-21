'use client';

import { useEffect, useState, useMemo } from 'react';
import { App, Table, Tag, Space, Button, Segmented } from 'antd';
import { TableOutlined, AppstoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import { pembinaService } from '@/services/pembinaService';
import { PembinaUser, CreatePembinaInput, UpdatePembinaInput } from '@/types/pembina';
import PembinaForm from './components/PembinaForm';

export default function PembinaManagementPage() {
  const { message, modal } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [pembinas, setPembinas] = useState<PembinaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPembina, setEditingPembina] = useState<PembinaUser | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  
  // State Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('grid');
    }
    checkAdminAccessAndLoadData();
  }, []);

  const checkAdminAccessAndLoadData = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      if (user.role === 'superadmin') {
        window.location.href = '/superadmin';
        return;
      }

      if (user.school && !user.school.subscription_active) {
        window.location.href = '/billing';
        return;
      }

      if (user.role !== 'admin') {
        message.error('Akses Ditolak! Halaman Manajemen Pembina hanya dapat diakses oleh Admin.');
        window.location.href = '/manajemen/siswa';
        return;
      }

      setCurrentUser(user);
      const data = await pembinaService.getAllPembina();
      setPembinas(data || []);
    } catch (error: any) {
      console.error('Error loading data:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePembina = async (input: CreatePembinaInput) => {
    const newPembina = await pembinaService.createPembina(input);
    setPembinas((prev) => [newPembina, ...prev]);
    message.success('Berhasil menambahkan akun pembina/pembantu pembina baru!');
  };

  const handleUpdatePembina = async (input: UpdatePembinaInput) => {
    if (input.id === currentUser?.id) {
      message.error('Anda tidak bisa mengedit akun Anda sendiri yang sedang aktif login!');
      return;
    }

    const updated = await pembinaService.updatePembina(input);
    setPembinas((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPembina(null);
    message.success('Berhasil memperbarui data pembina!');
  };

  const handleDeletePembina = async (id: string, targetName: string) => {
    if (id === currentUser?.id) {
      message.error('Anda tidak bisa menghapus akun Anda sendiri yang sedang aktif login!');
      return;
    }

    modal.confirm({
      title: 'Hapus Pembina',
      content: `Apakah Anda yakin ingin menghapus akun ${targetName}?`,
      okText: 'Hapus',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await pembinaService.deletePembina(id);
          setPembinas((prev) => prev.filter((item) => item.id !== id));
          message.success('Akun pembina berhasil dihapus.');
        } catch (error: any) {
          message.error(`Gagal menghapus: ${error?.message || 'Terjadi kesalahan'}`);
        }
      },
    });
  };

  // 🎯 Filter berdasarkan Pencarian (Nama/Username) dan Dropdown Role
  const filteredPembinas = useMemo(() => {
    return pembinas.filter((p) => {
      const matchesSearch =
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.username.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = selectedRole === 'ALL' || p.role === selectedRole;

      return matchesSearch && matchesRole;
    });
  }, [pembinas, searchQuery, selectedRole]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return <PageLoader text="Memuat Data Pembina & Pembantu Pembina..." />;
  }

  const isAdmin = currentUser?.role === 'admin';

  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <span className="font-semibold text-slate-600 text-xs">{index + 1}</span>
      ),
    },
    {
      title: 'Nama Lengkap',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string, record: PembinaUser) => (
        <div>
          <div className="font-bold text-slate-900 text-xs sm:text-sm">{name}</div>
          <div className="text-[11px] font-mono text-slate-400">@{record.username}</div>
        </div>
      ),
    },
    {
      title: 'Role Akses',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: string, record: PembinaUser) => {
        const isSelf = record.id === currentUser?.id;
        let color = 'blue';
        if (role === 'admin') color = 'magenta';
        if (role === 'instruktur') color = 'gold';

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag color={color} className="uppercase font-bold text-[10px] rounded-md px-2 py-0.5">
              {role === 'instruktur' ? 'Pembantu Pembina' : role}
            </Tag>
            {isSelf && (
              <Tag color="green" className="font-bold text-[9px] rounded-md px-1.5 py-0.2">
                Anda
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Terdaftar Sejak',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (dateStr: string) => (
        <span className="font-mono text-xs text-slate-500">{formatDate(dateStr)}</span>
      ),
    },
    {
      title: 'Aksi',
      key: 'aksi',
      width: 140,
      align: 'center' as const,
      render: (_: any, record: PembinaUser) => {
        const isSelf = record.id === currentUser?.id;
        if (!isAdmin || isSelf) {
          return <span className="text-slate-300 text-xs">-</span>;
        }

        return (
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setShowForm(false);
                setEditingPembina(record);
              }}
              className="text-indigo-600 hover:bg-indigo-50 rounded-lg"
              title="Edit Akun"
            />
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDeletePembina(record.id, record.full_name)}
              className="text-rose-600 hover:bg-rose-50 rounded-lg"
              title="Hapus Akun"
            />
          </Space>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Global */}
        <Header 
          title="Manajemen Akun Pembina & Pembantu Pembina" 
          subtitle="Hak Akses Khusus Admin • Gugusdepan" 
        />

        {/* Action Bar & Filter Container */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Daftar Pembina ({pembinas.length} / {currentUser?.school?.max_users ?? '-'})
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Akun pengelola terikat eksklusif untuk {currentUser?.school?.name || 'sekolah Anda'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as 'table' | 'grid')}
                options={[
                  { label: 'Tabel', value: 'table', icon: <TableOutlined /> },
                  { label: 'Grid', value: 'grid', icon: <AppstoreOutlined /> },
                ]}
                className="bg-slate-100 p-1 rounded-2xl"
              />

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingPembina(null);
                    setShowForm(true);
                  }}
                  className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  ➕ Tambah Pembina
                </button>
              )}
            </div>
          </div>

          {/* Baris Input Search & Dropdown Filter Role */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Cari Pengelola
              </label>
              <input
                type="text"
                placeholder="Cari nama atau username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Filter Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              >
                <option value="ALL">Semua Role</option>
                <option value="admin">Admin</option>
                <option value="pembina">Pembina</option>
                <option value="instruktur">Pembantu Pembina</option>
              </select>
            </div>
          </div>
        </div>

        {/* Form Modal (Tambah / Edit) */}
        {isAdmin && (
          <PembinaForm
            open={showForm || Boolean(editingPembina)}
            initialData={editingPembina}
            onSuccess={() => {
              setShowForm(false);
              setEditingPembina(null);
            }}
            onSubmitPembina={handleCreatePembina}
            onUpdatePembina={handleUpdatePembina}
          />
        )}

        {/* Container Tampilan Tabel atau Grid */}
        {viewMode === 'table' ? (
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <Table
              dataSource={filteredPembinas}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, size: 'small', showTotal: (total) => `Total ${total} pengelola` }}
              size="middle"
              scroll={{ x: 600 }}
            />
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            {filteredPembinas.length === 0 ? (
              <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <span className="text-3xl">🔍</span>
                <p className="text-sm font-semibold text-slate-500">
                  Tidak ada akun pengelola yang cocok dengan filter.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRole('ALL');
                  }}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPembinas.map((pembina) => {
                  const isSelf = pembina.id === currentUser?.id;

                  return (
                    <div
                      key={pembina.id}
                      className="bg-slate-50/70 hover:bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-3 transition flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                                pembina.role === 'admin'
                                  ? 'bg-rose-100 text-rose-700'
                                  : pembina.role === 'pembina'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {pembina.role === 'instruktur' ? 'Pembantu Pembina' : pembina.role}
                            </span>
                            {isSelf && (
                              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                                Anda
                              </span>
                            )}
                          </div>

                          <span className="text-xs font-mono text-slate-400">
                            @{pembina.username}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-base">
                          {pembina.full_name}
                        </h3>
                      </div>

                      <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                        <span className="font-mono text-[11px]">
                          {formatDate(pembina.created_at)}
                        </span>

                        {isAdmin && !isSelf && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setShowForm(false);
                                setEditingPembina(pembina);
                              }}
                              className="text-indigo-600 hover:text-indigo-700 font-bold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition"
                            >
                              Edit ✏️
                            </button>

                            <button
                              onClick={() => handleDeletePembina(pembina.id, pembina.full_name)}
                              className="text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition"
                            >
                              Hapus 🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
