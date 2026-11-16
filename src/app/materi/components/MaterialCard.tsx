'use client';

import React, { useState } from 'react';
import { Modal } from 'antd';
import { Material } from '@/types/material';
import { UserSessionData } from '@/lib/auth';

interface MaterialCardProps {
  material: Material;
  currentUser: UserSessionData | null;
  onEdit: (mat: Material) => void;
  onDelete: (id: string) => void;
}

const MAX_VISIBLE_EQUIPMENT = 3;

function EquipmentBadge({ isMandatory }: { isMandatory: boolean }) {
  return (
    <span
      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md ${
        isMandatory
          ? 'bg-rose-100 text-rose-700 border border-rose-200'
          : 'bg-slate-200 text-slate-600'
      }`}
    >
      {isMandatory ? 'Wajib' : 'Opsional'}
    </span>
  );
}

export default function MaterialCard({ material, currentUser, onEdit, onDelete }: MaterialCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  const equipment = material.equipment || [];
  const visibleEquipment = equipment.slice(0, MAX_VISIBLE_EQUIPMENT);
  const hiddenCount = equipment.length - visibleEquipment.length;
  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition">
        {/* Konten atas: tinggi fleksibel agar footer selalu sejajar di bawah */}
        <div className="flex-1 space-y-3">
          <span className="inline-block text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
            {material.category}
          </span>

          <h3 className="font-extrabold text-base text-slate-900 leading-snug line-clamp-2">
            {material.title}
          </h3>

          {/* Deskripsi dipotong 4 baris agar semua kartu seragam */}
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-line">
            {material.description}
          </p>

          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Lihat selengkapnya →
          </button>

          {/* Ringkasan alat: maksimal 3 item */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              📦 Alat & Barang Bawaan ({equipment.length})
            </h4>
            {equipment.length > 0 ? (
              <ul className="space-y-1.5">
                {visibleEquipment.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 font-medium truncate" title={item.name}>
                      🔹 {item.name}
                    </span>
                    <EquipmentBadge isMandatory={item.isMandatory} />
                  </li>
                ))}
                {hiddenCount > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setShowDetail(true)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600"
                    >
                      +{hiddenCount} alat lainnya
                    </button>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Tidak ada alat khusus yang diperlukan.</p>
            )}
          </div>
        </div>

        {/* Footer aksi: selalu menempel di bawah kartu */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3.5 py-2 rounded-xl transition"
          >
            👁️ Detail
          </button>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(material)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => onDelete(material.id)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3.5 py-2 rounded-xl transition"
              >
                🗑️ Hapus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal detail lengkap: deskripsi penuh + seluruh daftar alat */}
      <Modal
        open={showDetail}
        onCancel={() => setShowDetail(false)}
        footer={null}
        centered
        width={640}
        title={null}
        destroyOnHidden
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <span className="inline-block text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
              {material.category}
            </span>
            <h3 className="font-extrabold text-lg text-slate-900 leading-snug pr-6">
              {material.title}
            </h3>
          </div>

          <div className="max-h-[45vh] overflow-y-auto pr-1">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {material.description}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              📦 Daftar Alat & Barang Bawaan ({equipment.length})
            </h4>
            {equipment.length > 0 ? (
              <ul className="space-y-1.5 max-h-[25vh] overflow-y-auto">
                {equipment.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 font-medium">🔹 {item.name}</span>
                    <EquipmentBadge isMandatory={item.isMandatory} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Tidak ada alat khusus yang diperlukan.</p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
