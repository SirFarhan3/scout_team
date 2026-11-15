'use client';

import React from 'react';

interface AiGeneratorModalProps {
  isOpen: boolean;
  aiTopic: string;
  aiLevel: string;
  aiDuration: string;
  isGenerating: boolean;
  onClose: () => void;
  onTopicChange: (val: string) => void;
  onLevelChange: (val: string) => void;
  onDurationChange: (val: string) => void;
  onGenerate: () => void;
}

export default function AiGeneratorModal({
  isOpen,
  aiTopic,
  aiLevel,
  aiDuration,
  isGenerating,
  onClose,
  onTopicChange,
  onLevelChange,
  onDurationChange,
  onGenerate,
}: AiGeneratorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
            ✨ AI Lesson & Equipment Generator
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-sm">
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Masukkan topik latihan yang diinginkan. AI akan otomatis merancang rincian run-down pertemuan, daftar barang bawaan peserta, dan detail materi lengkapnya!
        </p>

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Topik / Judul Latihan</label>
            <input
              type="text"
              placeholder="Contoh: Pionering Menara Kaki Tiga / Sandhi Kotak 1"
              value={aiTopic}
              onChange={(e) => onTopicChange(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Golongan</label>
              <select
                value={aiLevel}
                onChange={(e) => onLevelChange(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700"
              >
                <option value="Penggalang Ramu">Penggalang Ramu</option>
                <option value="Penggalang Rakit">Penggalang Rakit</option>
                <option value="Penggalang Terap">Penggalang Terap</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Durasi Latihan</label>
              <select
                value={aiDuration}
                onChange={(e) => onDurationChange(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700"
              >
                <option value="60 Menit">60 Menit</option>
                <option value="90 Menit">90 Menit</option>
                <option value="120 Menit">120 Menit (2 Jam)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={onGenerate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin text-sm">⏳</span>
                <span>Merancang Materi...</span>
              </>
            ) : (
              <>
                <span>✨ Generate Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}