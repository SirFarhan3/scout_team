'use client';

interface QuickActionsProps {
  isAdmin: boolean;
}

export default function QuickActions({ isAdmin }: QuickActionsProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <h2 className="text-base font-bold text-slate-900">⚡ Menu Pintasan</h2>

      <div className="space-y-2.5">
        <button
          onClick={() => (window.location.href = '/scan')}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-3 px-4 rounded-2xl transition flex items-center justify-between shadow-sm shadow-indigo-200"
        >
          <span>📷 Scan QR / Absensi Manual</span>
        </button>

        <button
          onClick={() => (window.location.href = '/ranking')}
          className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold py-3 px-4 rounded-2xl transition border border-amber-200 flex items-center justify-between"
        >
          <span>🏆 Klasemen Ranking & Minigames</span>
          <span>→</span>
        </button>

        <button
          onClick={() => (window.location.href = '/manajemen/poin')}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-slate-200 flex items-center justify-between"
        >
          <span>⚙️ Manajemen Poin (+ / -)</span>
        </button>

        <button
          onClick={() => (window.location.href = '/manajemen/regu')}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-slate-200 flex items-center justify-between"
        >
          <span>🚩 Manajemen Regu</span>
        </button>

        <button
          onClick={() => (window.location.href = '/manajemen/siswa')}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-slate-200 flex items-center justify-between"
        >
          <span>👥 Manajemen Anggota</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => (window.location.href = '/manajemen/pembina')}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-slate-200 flex items-center justify-between"
            >
              <span>🛡️ Manajemen Pembina</span>
            </button>
            <button
              onClick={() => (window.location.href = '/billing')}
              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold py-3 px-4 rounded-2xl transition border border-amber-200 flex items-center justify-between"
            >
              <span>💳 Langganan & Lisensi Sekolah</span>
            </button>
            <button
              onClick={() => (window.location.href = '/pengaturan')}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-slate-200 flex items-center justify-between"
            >
              <span>🏫 Pengaturan Sekolah & Akun</span>
            </button>
          </>
        )}

        <button
          onClick={() => (window.location.href = '/laporan/nilai')}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-slate-200 flex items-center justify-between"
        >
          <span>📊 Laporan Nilai & Kehadiran</span>
        </button>

        <button
          onClick={() => (window.location.href = '/laporan/log-harian')}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-slate-200 flex items-center justify-between"
        >
          <span>📝 Laporan Log Harian</span>
        </button>

        <button
          onClick={() => (window.location.href = '/menu')}
          className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-3 px-4 rounded-2xl transition border border-indigo-200 flex items-center justify-between"
        >
          <span>🗺️ Lihat Semua Menu Aplikasi</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
