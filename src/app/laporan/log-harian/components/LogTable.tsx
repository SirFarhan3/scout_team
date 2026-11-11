'use client';

import React from 'react';
import dayjs from 'dayjs';
import { EyeOutlined, EditOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';

interface LogTableProps {
  logs: any[];
  loading: boolean;
  onView: (record: any) => void;
  onEdit: (record: any) => void;
  onDownload: (record: any) => void;
  onDelete: (id: string) => void;
}

export default function LogTable({ logs, loading, onView, onEdit, onDownload, onDelete }: LogTableProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
              <th className="py-3 px-4 w-16 text-center">No</th>
              <th className="py-3 px-4">Tanggal Kegiatan</th>
              <th className="py-3 px-4 text-center">Jumlah Kegiatan</th>
              <th className="py-3 px-4 text-center w-48">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">Memuat data...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">Belum ada arsip log harian.</td>
              </tr>
            ) : (
              logs.map((item, index) => {
                const count = Array.isArray(item.kegiatan) ? item.kegiatan.length : 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4 text-center font-semibold text-slate-600">{index + 1}</td>
                    <td className="py-4 px-4 font-bold text-slate-800">
                      {dayjs(item.tanggal).format('DD MMMM YYYY')}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full text-[10px]">
                        {count} Kegiatan
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => onView(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                          title="Lihat / Preview"
                        >
                          <EyeOutlined />
                        </button>
                        <button 
                          onClick={() => onEdit(item)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition"
                          title="Edit Log"
                        >
                          <EditOutlined />
                        </button>
                        <button 
                          onClick={() => onDownload(item)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition"
                          title="Download / Print PDF"
                        >
                          <DownloadOutlined />
                        </button>
                        <button 
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                          title="Hapus Log"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}