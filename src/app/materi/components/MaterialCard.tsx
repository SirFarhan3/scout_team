'use client';

import React from 'react';
import { Material } from '@/types/material';
import { UserSessionData } from '@/lib/auth';

interface MaterialCardProps {
  material: Material;
  currentUser: UserSessionData | null;
  onEdit: (mat: Material) => void;
  onDelete: (id: string) => void;
}

export default function MaterialCard({ material, currentUser, onEdit, onDelete }: MaterialCardProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex justify-between items-start gap-2">
          <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
            {material.category}
          </span>
        </div>

        <h3 className="font-extrabold text-base text-slate-900">{material.title}</h3>
        <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
          {material.description}
        </p>
      </div>

      {/* List Barang Bawaan / Alat */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2">
        <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          📦 Daftar Alat & Barang Bawaan:
        </h4>
        {material.equipment && material.equipment.length > 0 ? (
          <ul className="space-y-1.5">
            {material.equipment.map((item, idx) => (
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

      {/* Tombol Aksi Admin */}
      {currentUser?.role === 'admin' && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(material)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <span>✏️ Edit</span>
          </button>
          <button
            onClick={() => onDelete(material.id)}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <span>🗑️ Hapus</span>
          </button>
        </div>
      )}
    </div>
  );
}