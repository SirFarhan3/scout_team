'use client';

import { useEffect, useState, useMemo } from 'react';
import Header from '@/components/Header';
import { authService, UserSessionData } from '@/lib/auth';
import { pembinaService } from '@/services/pembinaService';
import { PembinaUser, CreatePembinaInput, UpdatePembinaInput } from '@/types/pembina';
import PembinaForm from './components/PembinaForm';

export default function PembinaManagementPage() {
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [pembinas, setPembinas] = useState<PembinaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPembina, setEditingPembina] = useState<PembinaUser | null>(null);
  
  // State Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  useEffect(() => {
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

      if (user.role !== 'admin') {
        alert('Akses Ditolak! Halaman Manajemen Pembina hanya dapat diakses oleh Admin.');
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
  };

  const handleUpdatePembina = async (input: UpdatePembinaInput) => {
    if (input.id === currentUser?.id) {
      alert('Anda tidak bisa mengedit akun Anda sendiri yang sedang aktif login!');
      return;
    }

    const updated = await pembinaService.updatePembina(input);
    setPembinas((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPembina(null);
  };

  const handleDeletePembina = async (id: string, targetName: string) => {
    if (id === currentUser?.id) {
      alert('Anda tidak bisa menghapus akun Anda sendiri yang sedang aktif login!');
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus akun ${targetName}?`)) {
      try {
        await pembinaService.deletePembina(id);
        setPembinas((prev) => prev.filter((item) => item.id !== id));
      } catch (error: any) {
        alert(`Gagal menghapus: ${error?.message || 'Terjadi kesalahan'}`);
      }
    }
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
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl shadow-lg border border-slate-100">
          <span className="animate-spin text-2xl">⚡</span>
          <span className="text-sm font-bold text-slate-700">Memverifikasi Hak Akses Admin...</span>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Global */}
        <Header 
          title="Manajemen Akun Pembina & Instruktur" 
          subtitle="Hak Akses Khusus Admin • Gugusdepan" 
        />

        {/* Action Bar & Filter Container */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Daftar Pembina
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Kelola kredensial dan hak akses pengelola pramuka
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingPembina(null);
                  setShowForm(!showForm);
                }}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
              >
                {showForm || editingPembina ? '❌ Batal' : '➕ Tambah Pembina'}
              </button>
            )}
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
                <option value="instruktur">Instruktur</option>
              </select>
            </div>
          </div>
        </div>

        {/* Form Modal (Tambah / Edit) */}
        {isAdmin && (showForm || editingPembina) && (
          <PembinaForm
            initialData={editingPembina}
            onSuccess={() => {
              setShowForm(false);
              setEditingPembina(null);
            }}
            onSubmitPembina={handleCreatePembina}
            onUpdatePembina={handleUpdatePembina}
          />
        )}

        {/* Container Utama Putih */}
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
                            {pembina.role}
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

      </div>
    </div>
  );
}