'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { App } from 'antd';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import {
  ProkerFilterBar,
  ProkerGeneratorModal,
  ProkerPreviewModal,
  ProkerTable,
  ProkerViewModal,
} from './components';
import { ProkerItem } from '@/types/program-kerja';
import { prokerService } from '@/services/prokerService';
import { assertSafeText } from '@/lib/sanitize';
import { apiFetch } from '@/lib/apiClient';

export default function ProkerTahunanPage() {
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  // State untuk melacak apakah sedang mengedit data yang sudah ada
  const [editingId, setEditingId] = useState<string | null>(null);

  // State Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGolongan, setSelectedGolongan] = useState('ALL');

  // State Modal Generator Form
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // State Modal Editable Preview sebelum save
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<any>({});
  const [editableActivities, setEditableActivities] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // State Modal View/Cetak Arsip
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedViewData, setSelectedViewData] = useState<ProkerItem | null>(null);

  // Data utama arsip program kerja & Loading Table
  const [prokers, setProkers] = useState<ProkerItem[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);

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
      setCurrentUser(user);
      fetchProkers();
    });
  }, []);

  const fetchProkers = async () => {
    try {
      setLoadingTable(true);
      const data = await prokerService.getAllProkers();
      setProkers(data);
    } catch (error: any) {
      console.error('Gagal memuat data program kerja:', error.message);
      message.error(error.message || 'Gagal memuat arsip program kerja dari database.');
    } finally {
      setLoadingTable(false);
    }
  };

  // 1. AI Generate diproses & dimasukkan ke Preview Editable
  const handleAiGenerate = async (values: any) => {
    try {
      setGenerating(true);

      const data = await apiFetch<{
        success: boolean;
        kegiatan?: any[];
        message?: string;
      }>('/api/program-kerja', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      setPreviewMeta({
        tahun_ajaran: values.tahunAjaran,
        golongan: values.golongan,
        nama_pangkalan: values.namaPangkalan,
      });

      const kegiatanList = Array.isArray(data.kegiatan) ? data.kegiatan : [];
      
      // Berikan ID unik pada tiap item untuk mencegah error key list di Antd Table
      const kegiatanWithId = kegiatanList.map((item: any, index: number) => ({
        id: `ai-${index}-${Date.now()}`,
        ...item,
      }));

      setEditableActivities(kegiatanWithId);

      setIsGeneratorModalOpen(false);
      setIsPreviewModalOpen(true);
      message.success('Program kerja berhasil digenerate! Silakan tinjau dan edit sebelum disimpan.');
    } catch (error: any) {
      console.error('Error generating proker:', error);
      message.error(error.message || 'Gagal menghasilkan program kerja.');
    } finally {
      setGenerating(false);
    }
  };

  // 2. Handler untuk mengedit isi sel tabel secara langsung
  const handleCellChange = (index: number, field: string, value: string) => {
    const updated = [...editableActivities];
    updated[index] = { ...updated[index], [field]: value };
    setEditableActivities(updated);
  };

  // 3. Tambah baris baru secara manual di preview
  const handleAddRow = () => {
    setEditableActivities([
      ...editableActivities,
      { 
        id: `manual-${Date.now()}`,
        pekan_ke: 'Pekan Baru', 
        durasi: '00.15 - 00.45', 
        kegiatan: 'Kegiatan Baru', 
        ket_kegiatan: 'Tulis keterangan kegiatan di sini...' 
      },
    ]);
  };

  // 4. Hapus baris kegiatan
  const handleDeleteRow = (index: number) => {
    const updated = editableActivities.filter((_, i) => i !== index);
    setEditableActivities(updated);
  };

  // 5. Simpan permanen ke Database Supabase setelah diedit (Sudah Bersih & Tidak Duplikat)
  const handleConfirmSave = async () => {
    try {
      setSaving(true);

      const safeTahunAjaran = assertSafeText(previewMeta.tahun_ajaran, 'Tahun Ajaran', 40);
      const safeGolongan = assertSafeText(previewMeta.golongan, 'Golongan', 50);
      const safeNamaPangkalan = assertSafeText(previewMeta.nama_pangkalan, 'Nama Pangkalan', 150);

      const safeActivities = editableActivities.map((act, idx) => ({
        ...act,
        pekan_ke: assertSafeText(act.pekan_ke, `Pekan baris #${idx + 1}`, 80),
        durasi: assertSafeText(act.durasi, `Durasi baris #${idx + 1}`, 60),
        kegiatan: assertSafeText(act.kegiatan, `Kegiatan baris #${idx + 1}`, 500),
        ...(act.keterangan_kegiatan !== undefined
          ? { keterangan_kegiatan: assertSafeText(act.keterangan_kegiatan, `Keterangan baris #${idx + 1}`, 1500) }
          : {}),
        ...(act.ket_kegiatan !== undefined
          ? { ket_kegiatan: assertSafeText(act.ket_kegiatan, `Keterangan baris #${idx + 1}`, 1500) }
          : {}),
      }));

      const payload = {
        tahun_ajaran: safeTahunAjaran,
        golongan: safeGolongan,
        nama_pangkalan: safeNamaPangkalan,
        kegiatan: safeActivities,
      };

      if (editingId) {
        const updated = await prokerService.updateProker(editingId, payload);
        setProkers(prokers.map((p) => (p.id === editingId ? updated : p)));
        message.success('Program Kerja berhasil diperbarui!');
      } else {
        const created = await prokerService.createProker(payload);
        setProkers([created, ...prokers]);
        message.success('Program Kerja berhasil disimpan ke Database!');
      }

      setIsPreviewModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      console.error('Gagal menyimpan:', error.message);
      message.error('Gagal menyimpan ke database: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenView = (record: ProkerItem) => {
    setSelectedViewData(record);
    setIsViewModalOpen(true);
  };

  const handleOpenEdit = (record: ProkerItem) => {
    setEditingId(record.id || null);
    setPreviewMeta({
      tahun_ajaran: record.tahun_ajaran,
      golongan: record.golongan,
      nama_pangkalan: record.nama_pangkalan,
    });

    // Pastikan kegiatan punya id unik tiap barisnya
    const kegiatanWithId = (record.kegiatan || []).map((item: any, idx: number) => ({
      id: item.id || `edit-${idx}-${Date.now()}`,
      ...item,
    }));
    
    setEditableActivities(kegiatanWithId);
    setIsPreviewModalOpen(true);
  };

  // 6. Hapus arsip dari Database via Server API
  const handleDelete = async (id: string) => {
    try {
      await prokerService.deleteProker(id);
      setProkers(prokers.filter((p) => p.id !== id));
      message.success('Program kerja berhasil dihapus dari database.');
    } catch (error: any) {
      console.error('Gagal menghapus:', error.message);
      message.error('Gagal menghapus data: ' + error.message);
    }
  };

  // Filter data berdasarkan search query dan dropdown golongan
  const filteredProkers = useMemo(() => {
    return prokers.filter((item) => {
      const matchesSearch =
        item.nama_pangkalan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tahun_ajaran.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGolongan =
        selectedGolongan === 'ALL' || item.golongan.toLowerCase() === selectedGolongan.toLowerCase();

      return matchesSearch && matchesGolongan;
    });
  }, [prokers, searchQuery, selectedGolongan]);

  if (loadingTable) {
    return <PageLoader text="Memuat Arsip Program Kerja..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 1. Header Global */}
        <Header 
          title="Rancangan Program Kerja Tahunan" 
          subtitle="Sistem Informasi Scout Management • Gugusdepan" 
        />

        {/* 2. Action Bar & Filter Container */}
        <ProkerFilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedGolongan={selectedGolongan}
          setSelectedGolongan={setSelectedGolongan}
          onOpenGenerator={() => setIsGeneratorModalOpen(true)}
        />

        {/* 3. Container Utama Tabel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Arsip Program Kerja
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Daftar rancangan program kerja tahunan dan jadwal latihan mingguan
            </p>
          </div>

          {filteredProkers.length === 0 && !loadingTable ? (
            <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
              <span className="text-3xl">🔍</span>
              <p className="text-sm font-semibold text-slate-500">
                {prokers.length === 0 
                  ? 'Belum ada arsip program kerja yang disimpan.' 
                  : 'Tidak ada program kerja yang cocok dengan filter pencarian.'}
              </p>
              {prokers.length > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGolongan('ALL');
                  }}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <ProkerTable 
              prokers={filteredProkers}
              loading={loadingTable}
              onView={handleOpenView}
              onEdit={handleOpenEdit}
              onDownload={handleOpenView}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* Modal Form Parameter AI Generator */}
        <ProkerGeneratorModal
          isOpen={isGeneratorModalOpen}
          onClose={() => setIsGeneratorModalOpen(false)}
          onGenerate={handleAiGenerate}
          generating={generating}
        />

        {/* Modal Pratinjau Editable Sebelum Disimpan */}
        <ProkerPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          previewMeta={previewMeta}
          activities={editableActivities}
          onCellChange={handleCellChange}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
          onSave={handleConfirmSave}
          saving={saving}
        />

        {/* Modal View & Cetak Dokumen Resmi Arsip */}
        <ProkerViewModal 
          isOpen={isViewModalOpen}
          viewData={selectedViewData}
          schoolCity={currentUser?.school?.city}
          onClose={() => setIsViewModalOpen(false)}
        />

      </div>
    </div>
  );
}