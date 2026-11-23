'use client';

import { useEffect, useState, useCallback } from 'react';
import { App, Pagination } from 'antd';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { materialService } from '@/services/materialService';
import { Material } from '@/types/material';
import { authService, UserSessionData } from '@/lib/auth';
import { apiFetch } from '@/lib/apiClient';

// Import komponen terpisah
import MaterialCard from './components/MaterialCard';
import MaterialModal from './components/MaterialModal';
import AiGeneratorModal from './components/AiGeneratorModal';

const PAGE_SIZE = 9; // Grid 3x3 maksimal (9 kartu per halaman)

export default function MateriPage() {
  const { message, modal } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<string[]>(['Semua Kategori']);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Pagination State (Server-Side DB Range)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [fromRow, setFromRow] = useState<number>(0);
  const [toRow, setToRow] = useState<number>(0);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentList, setEquipmentList] = useState<{ name: string; isMandatory: boolean }[]>([
    { name: '', isMandatory: true },
  ]);

  // AI Generator State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLevel, setAiLevel] = useState('Penggalang');
  const [aiDuration, setAiDuration] = useState('90 Menit');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPlanCredits, setAiPlanCredits] = useState<number>(2);
  const [aiTopupCredits, setAiTopupCredits] = useState<number>(0);

  // Load user & daftar kategori awal
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
      if (user.school) {
        setAiPlanCredits(Math.max(0, Number(user.school.ai_plan_credits ?? 2) || 0));
        setAiTopupCredits(Math.max(0, Number(user.school.ai_topup_credits ?? 0) || 0));
      }
      materialService
        .getMaterialCategories()
        .then((cats) => setCategories(cats))
        .catch(() => {});
    });
  }, []);

  // Fungsi query ke DB menggunakan parameter pagination (Page 1: 1-9, Page 2: 10-18, dst.)
  const fetchPaginatedData = useCallback(
    async (pageToFetch: number, search: string, cat: string) => {
      try {
        setLoading(true);
        const result = await materialService.getPaginatedMaterials({
          page: pageToFetch,
          pageSize: PAGE_SIZE,
          search,
          category: cat,
        });

        setMaterials(result.data);
        setTotalItems(result.total);
        setFromRow(result.fromRow);
        setToRow(result.toRow);
      } catch (err) {
        console.error('Gagal memuat materi terpaginasi:', err);
        message.error('Gagal memuat daftar materi dari database');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!currentUser) return;
    fetchPaginatedData(currentPage, searchTerm, selectedCategory);
  }, [currentUser, currentPage, searchTerm, selectedCategory, fetchPaginatedData]);

  // Saat search atau kategori berubah, kembalikan ke halaman 1
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (val: string) => {
    setSelectedCategory(val);
    setCurrentPage(1);
  };

  const refreshAll = async () => {
    const cats = await materialService.getMaterialCategories().catch(() => ['Semua Kategori']);
    setCategories(cats);
    await fetchPaginatedData(currentPage, searchTerm, selectedCategory);
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setTitle('');
    setCategory('');
    setDescription('');
    setEquipmentList([{ name: '', isMandatory: true }]);
    setShowModal(true);
  };

  const handleOpenEditModal = (mat: Material) => {
    setIsEditing(true);
    setSelectedId(mat.id);
    setTitle(mat.title);
    setCategory(mat.category);
    setDescription(mat.description);
    setEquipmentList(
      mat.equipment && mat.equipment.length > 0
        ? mat.equipment
        : [{ name: '', isMandatory: true }]
    );
    setShowModal(true);
  };

  const handleAddEquipmentField = () => {
    setEquipmentList([...equipmentList, { name: '', isMandatory: true }]);
  };

  const handleEquipmentChange = (
    index: number,
    field: 'name' | 'isMandatory',
    value: string | boolean
  ) => {
    const updated = [...equipmentList];
    if (field === 'name') {
      updated[index].name = value as string;
    } else {
      updated[index].isMandatory = value as boolean;
    }
    setEquipmentList(updated);
  };

  const handleRemoveEquipmentField = (index: number) => {
    setEquipmentList(equipmentList.filter((_, i) => i !== index));
  };

  const handleGenerateAiContent = async () => {
    if (!aiTopic.trim()) {
      message.warning('Mohon masukkan topik atau judul latihan terlebih dahulu!');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await apiFetch<{
        success: boolean;
        error?: string;
        credits?: {
          ai_plan_credits: number;
          ai_topup_credits: number;
          ai_total_credits: number;
        };
        data: {
          title?: string;
          category?: string;
          description?: string;
          equipment?: Array<{ name: string; isMandatory: boolean }>;
        };
      }>('/api/material', {
        method: 'POST',
        body: JSON.stringify({
          topic: aiTopic,
          level: aiLevel,
          duration: aiDuration,
        }),
      });

      if (result.credits) {
        setAiPlanCredits(result.credits.ai_plan_credits);
        setAiTopupCredits(result.credits.ai_topup_credits);
      }
      // Sinkronkan juga cache user di latar belakang
      authService.getCurrentUser().then((u) => {
        if (u?.school) {
          setAiPlanCredits(u.school.ai_plan_credits);
          setAiTopupCredits(u.school.ai_topup_credits);
        }
      });

      setTitle(result.data.title || '');
      setCategory(result.data.category || '');
      setDescription(result.data.description || '');
      setEquipmentList(
        Array.isArray(result.data.equipment) && result.data.equipment.length > 0
          ? result.data.equipment
          : [{ name: '', isMandatory: true }]
      );

      setIsGenerating(false);
      setShowAiModal(false);
      message.success('Berhasil men-generate materi latihan dengan AI!');
    } catch (error: any) {
      console.error(error);
      message.error(error.message || 'Gagal menghubungi server AI');
      setIsGenerating(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validEquipment = equipmentList.filter((item) => item.name.trim() !== '');

      if (isEditing && selectedId) {
        await materialService.updateMaterial(selectedId, {
          title,
          category,
          description,
          equipment: validEquipment,
        });
      } else {
        await materialService.createMaterial({
          title,
          category,
          description,
          equipment: validEquipment,
        });
        setCurrentPage(1);
      }

      setShowModal(false);
      await refreshAll();
      message.success('Data materi berhasil disimpan!');
    } catch (err: any) {
      console.error('Gagal menyimpan materi:', err);
      const detail = err?.message || err?.details || '';
      message.error(`Gagal menyimpan data materi.${detail ? ` ${detail}` : ''}`);
    }
  };

  const handleDelete = async (id: string) => {
    modal.confirm({
      title: 'Hapus Materi',
      content: 'Yakin ingin menghapus materi ini?',
      okText: 'Hapus',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await materialService.deleteMaterial(id);
          // Jika halaman saat ini tinggal 1 item dan bukan halaman 1, mundur 1 halaman
          if (materials.length === 1 && currentPage > 1) {
            setCurrentPage((prev) => prev - 1);
          } else {
            await refreshAll();
          }
          message.success('Materi berhasil dihapus.');
        } catch (err) {
          message.error('Gagal menghapus materi.');
        }
      },
    });
  };

  if (initialLoading) {
    return <PageLoader text="Memuat Database Materi & Logistik..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Database Materi & Logistik"
          subtitle="Panduan materi latihan lengkap dengan daftar barang wajib dan opsional"
        />

        {/* Filter & Search Bar */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-slate-900">Daftar Materi</h2>
                <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  Total {totalItems} Materi
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    aiPlanCredits + aiTopupCredits > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  🤖 Sisa Kuota Generate AI: {aiPlanCredits + aiTopupCredits}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Menampilkan maksimal 9 kartu (3×3) per halaman langsung dari query database
              </p>
            </div>

            {(currentUser?.role === 'admin' || currentUser?.role === 'pembina') && (
              <button
                onClick={handleOpenAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-3 rounded-2xl transition shadow-sm shadow-indigo-100 flex items-center justify-center gap-2 shrink-0"
              >
                <span>➕ Tambah Materi Baru</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Cari Materi
              </label>
              <input
                type="text"
                placeholder="Cari judul atau isi materi..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Filter Kategori
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryFilterChange(e.target.value)}
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-bold text-slate-700"
              >
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* List Materi Grid (3x3 = 9 Kartu Maksimal) */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white p-6 rounded-3xl border border-slate-100 h-64 animate-pulse flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-24 h-4 bg-slate-200 rounded-full" />
                  <div className="w-3/4 h-5 bg-slate-200 rounded" />
                  <div className="w-full h-16 bg-slate-100 rounded-xl" />
                </div>
                <div className="w-full h-8 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-400">
              Tidak ada materi yang sesuai dengan pencarian atau filter.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
              {materials.map((mat) => (
                <MaterialCard
                  key={mat.id}
                  material={mat}
                  currentUser={currentUser}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Pagination Bar */}
            <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs font-semibold text-slate-500">
                Menampilkan data ke-<strong className="text-slate-800">{fromRow}</strong> s/d{' '}
                <strong className="text-slate-800">{toRow}</strong> dari total{' '}
                <strong className="text-indigo-600">{totalItems}</strong> materi (Halaman{' '}
                {currentPage})
              </p>

              <Pagination
                current={currentPage}
                pageSize={PAGE_SIZE}
                total={totalItems}
                showSizeChanger={false}
                onChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          </div>
        )}

        {/* Modal Form Tambah/Edit */}
        <MaterialModal
          isOpen={showModal}
          isEditing={isEditing}
          title={title}
          category={category}
          description={description}
          equipmentList={equipmentList}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitForm}
          onTitleChange={setTitle}
          onCategoryChange={setCategory}
          onDescriptionChange={setDescription}
          onAddEquipment={handleAddEquipmentField}
          onEquipmentChange={handleEquipmentChange}
          onRemoveEquipment={handleRemoveEquipmentField}
          onOpenAiModal={() => setShowAiModal(true)}
        />

        {/* Modal AI Generator */}
        <AiGeneratorModal
          isOpen={showAiModal}
          aiTopic={aiTopic}
          aiLevel={aiLevel}
          aiDuration={aiDuration}
          isGenerating={isGenerating}
          planCredits={aiPlanCredits}
          topupCredits={aiTopupCredits}
          onClose={() => setShowAiModal(false)}
          onTopicChange={setAiTopic}
          onLevelChange={setAiLevel}
          onDurationChange={setAiDuration}
          onGenerate={handleGenerateAiContent}
        />
      </div>
    </div>
  );
}
