'use client';

import React from 'react';
import { Modal, Button } from 'antd';
import { PrinterOutlined, QrcodeOutlined } from '@ant-design/icons';
import { Student } from '@/types/student';

interface StudentQRModalProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
}

export default function StudentQRModal({
  visible,
  student,
  onClose,
}: StudentQRModalProps) {
  if (!student) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
        title={null}
        open={visible}
        onCancel={onClose}
        footer={null}
        centered
        // Tambahkan print:hidden pada closeIcon supaya tombol silangnya ikut sembunyi saat dicetak
        closeIcon={<span className="print:hidden text-slate-400 hover:text-slate-700">✕</span>}
        className="rounded-3xl overflow-hidden print:shadow-none print:m-0"
    >
      <div className="p-6 text-center space-y-4">
        {/* Header Kartu */}
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Kartu Anggota Pramuka • Gugusdepan
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-2">{student.full_name}</h2>
          <p className="text-xs text-slate-500">
            Kelas: <strong className="text-slate-700">{student.class_name || '-'}</strong> | Regu: <strong className="text-amber-700">{student.group_name || '-'}</strong>
          </p>
        </div>

        {/* Kotak Tampilan QR Code */}
        <div className="py-6 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center space-y-3">
          <div className="w-32 h-32 bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
            <div className="text-center space-y-1">
              <QrcodeOutlined className="text-5xl text-indigo-600" />
            </div>
          </div>
          <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
            {student.qr_code_id}
          </span>
        </div>

        <div className="text-left text-[11px] text-slate-400 bg-slate-50 p-3 rounded-2xl space-y-1">
          <p>📌 <strong>NTA:</strong> {student.nta || '-'}</p>
          <p>💡 Gunakan QR Code ini untuk absensi cepat pada setiap kegiatan latihan rutin.</p>
        </div>

        {/* Tombol Aksi - Diberi class print:hidden agar hilang saat dicetak */}
        <div className="flex gap-2 pt-2 print:hidden">
          <Button 
            onClick={onClose} 
            className="flex-1 rounded-xl text-xs font-bold border-slate-200 py-2"
          >
            Tutup
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            className="flex-1 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 py-2 flex items-center justify-center gap-1"
          >
            Cetak Kartu
          </Button>
        </div>
      </div>
    </Modal>
  );
}