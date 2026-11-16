'use client';

import React, { useRef } from 'react';
import { Modal, Button, message } from 'antd';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import { Student } from '@/types/student';
import { escapeHtml, isSafePngDataUrl } from '@/lib/sanitize';

interface StudentQRModalProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
}

// Ukuran tampilan di layar & ukuran render resolusi tinggi untuk download/cetak
const DISPLAY_SIZE = 240;
const EXPORT_SIZE = 1024;
// Quiet zone (margin putih) wajib minimal 4 modul agar QR bisa terbaca scanner
const QUIET_ZONE_MODULES = 4;

export default function StudentQRModal({
  visible,
  student,
  onClose,
}: StudentQRModalProps) {
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!student) return null;

  // Nilai QR = qr_code_id (fallback ke id siswa; keduanya dikenali scanner)
  const qrValue = (student.qr_code_id || student.id || '').trim();

  const getQrDataUrl = (): string | null => {
    const canvas = exportCanvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : null;
  };

  // Gabungkan QR + nama anggota menjadi satu gambar PNG
  const buildCardImage = (): string | null => {
    const qrUrl = getQrDataUrl();
    const qrCanvas = exportCanvasRef.current;
    if (!qrUrl || !qrCanvas) return null;

    const labelHeight = 150;
    const card = document.createElement('canvas');
    card.width = qrCanvas.width;
    card.height = qrCanvas.height + labelHeight;

    const ctx = card.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, card.width, card.height);
    ctx.drawImage(qrCanvas, 0, 0);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.fillText(student.full_name, card.width / 2, qrCanvas.height + 20, card.width - 80);
    ctx.font = '34px Arial, sans-serif';
    ctx.fillText(
      `${student.class_name || '-'} • ${student.group_name || '-'}`,
      card.width / 2,
      qrCanvas.height + 78,
      card.width - 80
    );
    ctx.font = '30px monospace';
    ctx.fillText(qrValue, card.width / 2, qrCanvas.height + 124, card.width - 80);

    return card.toDataURL('image/png');
  };

  const handleDownload = () => {
    const dataUrl = buildCardImage();
    if (!dataUrl) {
      message.error('Gagal membuat gambar QR Code.');
      return;
    }

    const safeName = student.full_name.replace(/[^a-zA-Z0-9]+/g, '_');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${safeName}_${qrValue}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('QR Code berhasil diunduh.');
  };

  const handlePrint = () => {
    const dataUrl = buildCardImage();
    if (!dataUrl || !isSafePngDataUrl(dataUrl)) {
      message.error('Gagal membuat gambar QR Code.');
      return;
    }

    const win = window.open('', '_blank', 'width=600,height=800,noopener,noreferrer');
    if (!win) {
      message.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.');
      return;
    }

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Kartu QR - ${escapeHtml(student.full_name)}</title>
          <style>
            @page { size: A5; margin: 1cm; }
            body { margin: 0; display: flex; justify-content: center; align-items: flex-start; background: #fff; }
            img { width: 100%; max-width: 420px; image-rendering: pixelated; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR ${escapeHtml(student.full_name)}" />
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
      win.close();
    }, 300);
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      closeIcon={<span className="text-slate-400 hover:text-slate-700">✕</span>}
      className="rounded-3xl overflow-hidden"
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

        {/* QR Code: hitam pekat di atas putih dengan quiet zone 4 modul */}
        <div className="py-6 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center space-y-3">
          {qrValue ? (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center">
              <QRCodeCanvas
                value={qrValue}
                size={DISPLAY_SIZE}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                marginSize={QUIET_ZONE_MODULES}
                style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE, imageRendering: 'pixelated' }}
              />
            </div>
          ) : (
            <p className="text-xs font-bold text-rose-600">
              Anggota ini belum memiliki QR Code ID.
            </p>
          )}
          <span className="font-mono font-semibold text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 shadow-sm">
            {qrValue || '-'}
          </span>
        </div>

        {/* Canvas tersembunyi resolusi tinggi khusus untuk download & cetak */}
        {qrValue && (
          <div style={{ position: 'absolute', left: -99999, top: 0 }} aria-hidden="true">
            <QRCodeCanvas
              ref={exportCanvasRef}
              value={qrValue}
              size={EXPORT_SIZE}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
              marginSize={QUIET_ZONE_MODULES}
            />
          </div>
        )}

        <div className="text-left text-[11px] text-slate-400 bg-slate-50 p-3 rounded-2xl space-y-1">
          <p>📌 <strong>NTA:</strong> {student.nta || '-'}</p>
          <p>💡 Gunakan QR Code ini untuk absensi cepat pada setiap kegiatan latihan rutin.</p>
        </div>

        {/* Tombol Aksi */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onClose}
            className="flex-1 rounded-xl text-xs font-bold border-slate-200"
          >
            Tutup
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={!qrValue}
            className="flex-1 rounded-xl text-xs font-bold border-emerald-200 text-emerald-700"
          >
            Download
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            disabled={!qrValue}
            className="flex-1 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100"
          >
            Cetak
          </Button>
        </div>
      </div>
    </Modal>
  );
}
