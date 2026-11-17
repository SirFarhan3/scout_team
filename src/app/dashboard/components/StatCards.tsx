'use client';

interface StatCardsProps {
  hadirToday: number;
  izinSakitToday: number;
  belumAbsenToday: number;
}

export default function StatCards({
  hadirToday,
  izinSakitToday,
  belumAbsenToday,
}: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Card 1: Hadir Hari Ini (Pastel Mint) */}
      <div className="bg-emerald-50/70 p-5 sm:p-6 rounded-3xl shadow-sm border border-emerald-200/70 space-y-1.5 transition">
        <div className="flex items-center justify-between">
          <span className="text-emerald-700 text-xs font-extrabold uppercase tracking-wider">
            Hadir Hari Ini
          </span>
          <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
            ✅
          </span>
        </div>
        <div className="text-3xl font-black text-emerald-600">{hadirToday}</div>
        <p className="text-[11px] text-slate-500 font-medium">
          Anggota yang sudah scan / hadir
        </p>
      </div>

      {/* Card 2: Izin / Sakit (Pastel Honey Peach) */}
      <div className="bg-amber-50/70 p-5 sm:p-6 rounded-3xl shadow-sm border border-amber-200/70 space-y-1.5 transition">
        <div className="flex items-center justify-between">
          <span className="text-amber-700 text-xs font-extrabold uppercase tracking-wider">
            Izin / Sakit
          </span>
          <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm">
            📝
          </span>
        </div>
        <div className="text-3xl font-black text-amber-600">{izinSakitToday}</div>
        <p className="text-[11px] text-slate-500 font-medium">
          Berhalangan hadir dengan keterangan
        </p>
      </div>

      {/* Card 3: Belum Absen (Pastel Sakura Coral) */}
      <div className="bg-rose-50/70 p-5 sm:p-6 rounded-3xl shadow-sm border border-rose-200/70 space-y-1.5 transition">
        <div className="flex items-center justify-between">
          <span className="text-rose-700 text-xs font-extrabold uppercase tracking-wider">
            Belum Absen
          </span>
          <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-sm">
            ⏳
          </span>
        </div>
        <div className="text-3xl font-black text-rose-600">{belumAbsenToday}</div>
        <p className="text-[11px] text-slate-500 font-medium">
          Belum melakukan presensi hari ini
        </p>
      </div>
    </div>
  );
}
