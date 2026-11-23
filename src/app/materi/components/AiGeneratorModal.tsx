'use client';

import React from 'react';
import Link from 'next/link';

interface AiGeneratorModalProps {
  isOpen: boolean;
  aiTopic: string;
  aiLevel: string;
  aiDuration: string;
  isGenerating: boolean;
  planCredits?: number;
  topupCredits?: number;
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
  planCredits = 0,
  topupCredits = 0,
  onClose,
  onTopicChange,
  onLevelChange,
  onDurationChange,
  onGenerate,
}: AiGeneratorModalProps) {
  if (!isOpen) return null;

  const safePlan = Math.max(0, Number(planCredits) || 0);
  const safeTopup = Math.max(0, Number(topupCredits) || 0);
  const totalCredits = safePlan + safeTopup;
  const isOutOfCredits = totalCredits <= 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
            ✨ AI Lesson & Equipment Generator
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Indikator Sisa Kuota AI Sekolah (Shared Pool per school_id) */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-col gap-1.5 ${
            isOutOfCredits
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-extrabold">
              🤖 Sisa Kuota Generate AI: {totalCredits}{' '}
              <span className="font-semibold">
                (Paket: {safePlan})
              </span>
            </span>
          </div>
          <p className="text-[11px] opacity-80 leading-snug">
            Kuota dipakai bersama oleh seluruh Pembina sekolah Anda dan hanya terpotong jika AI berhasil merancang materi.
          </p>

          {isOutOfCredits && (
            <div className="pt-2 mt-1 border-t border-rose-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-rose-700">
                ⛔ Kuota AI sekolah Anda sudah habis!
              </span>
              <Link
                href="/billing#topup-ai"
                onClick={onClose}
                className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-xl shadow-sm transition shrink-0 inline-flex items-center gap-1"
              >
                🪙 Beli Token AI
              </Link>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Masukkan topik latihan yang diinginkan. AI akan otomatis merancang rincian run-down pertemuan, daftar barang bawaan peserta, dan detail materi lengkapnya!
        </p>

        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Topik / Judul Latihan
            </label>
            <input
              type="text"
              placeholder="Contoh: Pionering Menara Kaki Tiga / Sandi Kotak 1"
              value={aiTopic}
              onChange={(e) => onTopicChange(e.target.value)}
              disabled={isGenerating || isOutOfCredits}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-medium disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Golongan
              </label>
              <select
                value={aiLevel}
                onChange={(e) => onLevelChange(e.target.value)}
                disabled={isGenerating || isOutOfCredits}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 disabled:opacity-60"
              >
                <option value="Siaga">Siaga</option>
                <option value="Penggalang">Penggalang</option>
                <option value="Penegak">Penegak</option>
                <option value="Pandega">Pandega</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Durasi Latihan
              </label>
              <select
                value={aiDuration}
                onChange={(e) => onDurationChange(e.target.value)}
                disabled={isGenerating || isOutOfCredits}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 disabled:opacity-60"
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
            disabled={isGenerating || isOutOfCredits}
            onClick={onGenerate}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin text-sm">⏳</span>
                <span>Merancang Materi...</span>
              </>
            ) : isOutOfCredits ? (
              <span>⛔ Kuota AI Habis</span>
            ) : (
              <span>✨ Generate Sekarang</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
