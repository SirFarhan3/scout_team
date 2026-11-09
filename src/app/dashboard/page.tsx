'use client';

import { AttendanceRecord } from '@/types/attendance';

interface RecentActivityListProps {
  recentScans: AttendanceRecord[];
}

export default function RecentActivityList({ recentScans }: RecentActivityListProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 md:col-span-2">
      <h2 className="text-base font-bold text-slate-900">📋 Aktivitas Presensi Terbaru</h2>

      {recentScans.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
          <p className="text-xs font-semibold text-slate-400">
            Belum ada catatan presensi hari ini.
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
                  Kelas {scan.student?.class_name || '-'} • {scan.student?.group_name || '-'}
                </p>
              </div>

              <div className="text-right flex items-center gap-2">
                <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  {scan.status}
                </span>
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
  );
}