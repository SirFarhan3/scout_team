'use client';

import { useEffect, useState, useMemo } from 'react';
import Header from '@/components/Header';
import { materialService } from '@/services/materialService';
import { Material } from '@/types/material';
import { authService, UserSessionData } from '@/lib/auth';

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

  // Ambil daftar kategori unik untuk dropdown filter
  const categories = useMemo(() => {
    const cats = materials.map((m) => m.category);
    return ['Semua Kategori', ...Array.from(new Set(cats))];
  }, [materials]);

  // Filter materi berdasarkan search term & kategori
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
    } catch (err) {
      alert('Gagal menyimpan data materi.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus materi ini?')) {
      try {
        await materialService.deleteMaterial(id);
        loadData();
      } catch (err) {
        alert('Gagal menghapus materi.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Global */}
        <Header 
          title="Database Materi & Logistik" 
          subtitle="Panduan materi latihan lengkap dengan daftar barang wajib dan opsional" 
        />

        {/* 🔍 Filter & Search Bar Card */}
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
            {/* Input Pencarian */}
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

            {/* Filter Kategori */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter Kategori</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
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

        {/* Daftar Materi Grid */}
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
              <div key={mat.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                      {mat.category}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900">{mat.title}</h3>
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {mat.description}
                  </p>
                </div>

                {/* List Barang Bawaan / Alat */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    📦 Daftar Alat & Barang Bawaan:
                  </h4>
                  {mat.equipment && mat.equipment.length > 0 ? (
                    <ul className="space-y-1.5">
                      {mat.equipment.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium flex items-center gap-1.5">
                            <span className="text-[10px]">🔹</span> {item.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              item.isMandatory
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {item.isMandatory ? 'Mandatory (Wajib)' : 'Opsional'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Tidak ada alat khusus yang diperlukan.</p>
                  )}
                </div>

                {/* 🛠️ Tombol Aksi Admin di Bagian Bawah */}
                {currentUser?.role === 'admin' && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditModal(mat)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                    >
                      <span>✏️ Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(mat.id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                    >
                      <span>🗑️ Hapus</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal Form (Tambah / Edit) */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-base text-slate-900">
                  {isEditing ? '✏️ Edit Materi Latihan' : '➕ Tambah Materi Latihan Baru'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Materi</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Teknik Tandu Pramuka Darurat"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Keterampilan / Pionering"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Penjelasan / Deskripsi Materi</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Tuliskan langkah-langkah atau panduan materi..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>

                {/* Dinamis Input Equipment & Status Mandatory */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">Barang / Alat Bawaan</label>
                    <button
                      type="button"
                      onClick={handleAddEquipmentField}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      + Tambah Alat
                    </button>
                  </div>

                  {equipmentList.map((eq, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nama Alat (Cth: Tongkat Pramuka)"
                        value={eq.name}
                        onChange={(e) => handleEquipmentChange(index, 'name', e.target.value)}
                        className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                      />
                      <select
                        value={eq.isMandatory ? 'true' : 'false'}
                        onChange={(e) => handleEquipmentChange(index, 'isMandatory', e.target.value === 'true')}
                        className="text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                      >
                        <option value="true">Mandatory</option>
                        <option value="false">Opsional</option>
                      </select>
                      {equipmentList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipmentField(index)}
                          className="text-rose-500 hover:text-rose-700 px-1 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm"
                  >
                    {isEditing ? 'Simpan Perubahan' : 'Simpan Materi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}