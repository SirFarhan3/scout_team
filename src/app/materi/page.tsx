'use client';

import { useEffect, useState, useMemo } from 'react';
import { message, Modal } from 'antd';
import Header from '@/components/Header';
import { materialService } from '@/services/materialService';
import { Material } from '@/types/material';
import { authService, UserSessionData } from '@/lib/auth';

// Import komponen terpisah
import MaterialCard from './components/MaterialCard';
import MaterialModal from './components/MaterialModal';
import AiGeneratorModal from './components/AiGeneratorModal';

export default function MateriPage() {
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [aiLevel, setAiLevel] = useState('Penggalang Ramu');
  const [aiDuration, setAiDuration] = useState('90 Menit');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      setCurrentUser(user);

      const data = await materialService.getAllMaterials();
      setMaterials(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = materials.map((m) => m.category);
    return ['Semua Kategori', ...Array.from(new Set(cats))];
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((mat) => {
      const matchesSearch =
        mat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory =
        selectedCategory === 'Semua Kategori' || mat.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [materials, searchTerm, selectedCategory]);

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

  const handleEquipmentChange = (index: number, field: 'name' | 'isMandatory', value: string | boolean) => {
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
      const res = await fetch('/api/material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          level: aiLevel,
          duration: aiDuration,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        // Cek jika error karena server penuh/high demand
        if (result.error && result.error.includes('503')) {
          throw new Error('Server AI sedang padat (High Demand). Mohon coba beberapa saat lagi ya, bro!');
        }
        throw new Error(result.error || 'Terjadi kesalahan pada server AI');
      }

      setTitle(result.data.title);
      setCategory(result.data.category);
      setDescription(result.data.description);
      setEquipmentList(result.data.equipment || []);

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
      }

      setShowModal(false);
      loadData();
      message.success('Data materi berhasil disimpan!');
    } catch (err) {
      message.error('Gagal menyimpan data materi.');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Hapus Materi',
      content: 'Yakin ingin menghapus materi ini?',
      okText: 'Hapus',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await materialService.deleteMaterial(id);
          loadData();
          message.success('Materi berhasil dihapus.');
        } catch (err) {
          message.error('Gagal menghapus materi.');
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <Header 
          title="Database Materi & Logistik" 
          subtitle="Panduan materi latihan lengkap dengan daftar barang wajib dan opsional" 
        />

        {/* Filter & Search Bar */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Daftar Materi</h2>
              <p className="text-xs text-slate-500">Cari berdasarkan judul materi atau filter berdasarkan kategori</p>
            </div>

            {currentUser?.role === 'admin' && (
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cari Materi</label>
              <input
                type="text"
                placeholder="Cari judul atau isi materi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter Kategori</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-bold text-slate-700"
              >
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* List Materi Grid */}
        {loading ? (
          <div className="text-center py-12 text-xs font-semibold text-slate-400 animate-pulse">
            Memuat Database Materi...
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-400">Tidak ada materi yang sesuai dengan pencarian atau filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMaterials.map((mat) => (
              <MaterialCard
                key={mat.id}
                material={mat}
                currentUser={currentUser}
                onEdit={handleOpenEditModal}
                onDelete={handleDelete}
              />
            ))}
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