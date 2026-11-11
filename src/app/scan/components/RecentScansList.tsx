'use client';

import { AttendanceRecord } from '@/types/attendance';

interface RecentScansListProps {
  recentScans: AttendanceRecord[];
}

export default function RecentScansList({ recentScans }: RecentScansListProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 flex flex-col justify-between">
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          ⚡ Presensi Masuk Terbaru
        </h2>

        {recentScans.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
            <p className="text-xs font-semibold text-slate-400">
              Belum ada anggota yang di-scan hari ini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">
                    {scan.student?.full_name}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {scan.student?.class_name || 'Tanpa Kelas'} • {scan.student?.group_name}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {new Date(scan.created_at).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => (window.location.href = '/manajemen/siswa')}
        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3 rounded-2xl transition border border-slate-200 mt-4"
      >
        Manajemen Siswa
      </button>
    </div>
  );
}