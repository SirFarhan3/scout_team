'use client';

import React from 'react';
import { TrophyFilled, FireFilled, StarFilled } from '@ant-design/icons';

interface ReguItem {
  rank: number;
  namaRegu: string;
  golongan: string;
  pimpinan: string;
  poin: number;
  badgeColor: string;
}

export default function RankReguCard() {
  // Data dummy (nanti bisa dihubungkan ke Supabase jika sudah ada tabel regu/presensi)
  const reguList: ReguItem[] = [
    {
      rank: 1,
      namaRegu: 'Regu Elang',
      golongan: 'Penggalang',
      pimpinan: 'Pratama Farhan',
      poin: 950,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      rank: 2,
      namaRegu: 'Regu Harimau',
      golongan: 'Penggalang',
      pimpinan: 'Raihan',
      poin: 890,
      badgeColor: 'bg-slate-300 text-slate-800',
    },
    {
      rank: 3,
      namaRegu: 'Regu Kobra',
      golongan: 'Penggalang',
      pimpinan: 'Zaki',
      poin: 820,
      badgeColor: 'bg-amber-700 text-white',
    },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h2 className="text-base font-bold text-slate-900">Peringkat Regu Terbaik (Leaderboard)</h2>
        </div>
        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
          <FireFilled /> Bulan Ini
        </span>
      </div>

      <p className="text-xs text-slate-400 font-medium">
        Akumulasi poin kedisiplinan, kehadiran, dan keaktifan regu dalam kegiatan latihan rutin.
      </p>

      {/* List Peringkat */}
      <div className="space-y-3 pt-2">
        {reguList.map((item) => (
          <div 
            key={item.rank}
            className={`p-4 rounded-2xl border transition flex items-center justify-between ${
              item.rank === 1 
                ? 'bg-gradient-to-r from-amber-50/50 to-white border-amber-200 shadow-sm' 
                : 'bg-slate-50 border-slate-200/60 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Badge Rank / Nomor Urut */}
              <div className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-sm ${item.badgeColor}`}>
                {item.rank === 1 ? <TrophyFilled /> : `#${item.rank}`}
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-800">{item.namaRegu}</h4>
                  <span className="text-[9px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                    {item.golongan}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Pimp. Regu: {item.pimpinan}</p>
              </div>
            </div>

            {/* Total Poin */}
            <div className="text-right">
              <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 flex items-center gap-1">
                <StarFilled className="text-amber-500 text-[10px]" /> {item.poin} Poin
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tombol Aksi Detail */}
      <button 
        onClick={() => window.location.href = '/laporan/nilai'}
        className="w-full text-center py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition border border-dashed border-indigo-200 block"
      >
        Lihat Rekapitulasi Nilai & Kehadiran Lengkap →
      </button>
    </div>
  );
}