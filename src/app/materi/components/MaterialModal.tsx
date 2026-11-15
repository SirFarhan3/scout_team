'use client';

import React from 'react';

interface EquipmentItem {
  name: string;
  isMandatory: boolean;
}

interface MaterialModalProps {
  isOpen: boolean;
  isEditing: boolean;
  title: string;
  category: string;
  description: string;
  equipmentList: EquipmentItem[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onTitleChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onAddEquipment: () => void;
  onEquipmentChange: (index: number, field: 'name' | 'isMandatory', value: string | boolean) => void;
  onRemoveEquipment: (index: number) => void;
  onOpenAiModal: () => void;
}

export default function MaterialModal({
  isOpen,
  isEditing,
  title,
  category,
  description,
  equipmentList,
  onClose,
  onSubmit,
  onTitleChange,
  onCategoryChange,
  onDescriptionChange,
  onAddEquipment,
  onEquipmentChange,
  onRemoveEquipment,
  onOpenAiModal,
}: MaterialModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-base text-slate-900">
            {isEditing ? '✏️ Edit Materi Latihan' : '➕ Tambah Materi Latihan Baru'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-sm">
            ✕
          </button>
        </div>

        {/* Tombol Pemicu AI Generator */}
        {!isEditing && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-2xl text-white flex items-center justify-between shadow-md">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold flex items-center gap-1">✨ AI Lesson Generator</p>
              <p className="text-[10px] text-indigo-100">Otomatis buat run-down, alat, & detail materi dengan AI.</p>
            </div>
            <button
              type="button"
              onClick={onOpenAiModal}
              className="bg-white text-indigo-700 text-xs font-bold px-3.5 py-2 rounded-xl shadow hover:bg-indigo-50 transition shrink-0"
            >
              🤖 Buat dengan AI
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Judul Materi</label>
            <input
              type="text"
              required
              placeholder="Contoh: Teknik Tandu Pramuka Darurat"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
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
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Penjelasan / Deskripsi Materi & Run-down</label>
            <textarea
              required
              rows={5}
              placeholder="Tuliskan langkah-langkah atau panduan materi..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 whitespace-pre-line"
            />
          </div>

          {/* Dinamis Input Equipment */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">Barang / Alat Bawaan Peserta</label>
              <button
                type="button"
                onClick={onAddEquipment}
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
                  onChange={(e) => onEquipmentChange(index, 'name', e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
                <select
                  value={eq.isMandatory ? 'true' : 'false'}
                  onChange={(e) => onEquipmentChange(index, 'isMandatory', e.target.value === 'true')}
                  className="text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  <option value="true">Mandatory</option>
                  <option value="false">Opsional</option>
                </select>
                {equipmentList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveEquipment(index)}
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
              onClick={onClose}
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
  );
}