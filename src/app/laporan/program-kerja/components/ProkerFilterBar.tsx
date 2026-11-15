'use client';

import React from 'react';
import { Button } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

interface ProkerFilterBarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedGolongan: string;
  setSelectedGolongan: (val: string) => void;
  onOpenGenerator: () => void;
}

export default function ProkerFilterBar({
  searchQuery,
  setSearchQuery,
  selectedGolongan,
  setSelectedGolongan,
  onOpenGenerator,
}: ProkerFilterBarProps) {
  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Daftar Program Kerja
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Kelola dan generate rancangan program kerja Gugusdepan berbasis kecerdasan buatan
          </p>
        </div>

        <Button 
          type="primary" 
          icon={<RobotOutlined />} 
          onClick={onOpenGenerator}
          className="w-full sm:w-auto bg-indigo-600 hover:!bg-indigo-700 active:scale-95 text-white text-xs font-bold px-5 h-11 rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 border-none"
        >
          AI Proker Generator
        </Button>
      </div>

      {/* Baris Filter & Search Input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
        {/* Input Search Pangkalan / Tahun Ajaran */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Cari Program Kerja
          </label>
          <input
            type="text"
            placeholder="Cari pangkalan atau tahun ajaran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>

        {/* Select Filter Golongan */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Filter Golongan
          </label>
          <select
            value={selectedGolongan}
            onChange={(e) => setSelectedGolongan(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          >
            <option value="ALL">Semua Golongan</option>
            <option value="Siaga">Siaga</option>
            <option value="Penggalang">Penggalang</option>
            <option value="Penegak">Penegak</option>
            <option value="Pandega">Pandega</option>
          </select>
        </div>
      </div>
    </div>
  );
}
