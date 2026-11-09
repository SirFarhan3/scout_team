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
      {/* Card 1: Hadir Hari Ini */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Hadir Hari Ini</div>
        <div className="text-3xl font-extrabold text-emerald-600">{hadirToday}</div>
        <p className="text-[11px] text-slate-500">Anggota yang sudah scan / hadir</p>
      </div>

      {/* Card 2: Izin / Sakit */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Izin / Sakit</div>
        <div className="text-3xl font-extrabold text-amber-500">{izinSakitToday}</div>
        <p className="text-[11px] text-slate-500">Berhalangan hadir dengan keterangan</p>
      </div>

      {/* Card 3: Belum Absen */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Belum Absen</div>
        <div className="text-3xl font-extrabold text-rose-500">{belumAbsenToday}</div>
        <p className="text-[11px] text-slate-500">Belum melakukan presensi hari ini</p>
      </div>
    </div>
  );
}