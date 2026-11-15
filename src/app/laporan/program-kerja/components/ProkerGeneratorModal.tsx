'use client';

import React, { useState } from 'react';
import { Modal, Spin } from 'antd';

interface ProkerGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (values: any) => void;
  generating: boolean;
}

export default function ProkerGeneratorModal({
  isOpen,
  onClose,
  onGenerate,
  generating,
}: ProkerGeneratorModalProps) {
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
  const [golongan, setGolongan] = useState('Penggalang');
  const [namaPangkalan, setNamaPangkalan] = useState('');
  const [focus, setFocus] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({ tahunAjaran, golongan, namaPangkalan, focus, customPrompt });
  };

  return (
    <Modal
      title="Generate Program Kerja dengan AI"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      closable={!generating}
      mask={{ closable: !generating }}
    >
      <form onSubmit={handleSubmit} className="space-y-4 relative">
        
        {/* LOADING OVERLAY REDUP/GELAP DI TENGAH */}
        {generating && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-lg text-white space-y-3">
            <Spin size="large" />
            <div className="text-center">
              <p className="font-semibold text-sm">Sedang merancang program kerja...</p>
              <p className="text-xs text-slate-300">AI sedang menyusun jadwal mingguan terbaik untukmu.</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tahun Ajaran</label>
          <input
            type="text"
            value={tahunAjaran}
            onChange={(e) => setTahunAjaran(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            disabled={generating}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Golongan</label>
          <input
            type="text"
            value={golongan}
            onChange={(e) => setGolongan(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            disabled={generating}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pangkalan</label>
          <input
            type="text"
            value={namaPangkalan}
            onChange={(e) => setNamaPangkalan(e.target.value)}
            placeholder="Contoh: Gugus Depan 01.02"
            className="w-full px-3 py-2 border rounded-lg"
            disabled={generating}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fokus Utama</label>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Contoh: SKU & Keterampilan Kepanduan"
            className="w-full px-3 py-2 border rounded-lg"
            disabled={generating}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Tambahan</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Instruksi khusus (opsional)"
            className="w-full px-3 py-2 border rounded-lg"
            rows={2}
            disabled={generating}
          />
        </div>
        <button
          type="submit"
          disabled={generating}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-blue-300"
        >
          {generating ? 'Memproses...' : 'Mulai Generate'}
        </button>
      </form>
    </Modal>
  );
}