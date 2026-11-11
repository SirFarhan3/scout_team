'use client';

import React from 'react';
import { Modal, Button, Table, Tag } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';

// PERBARUI INI: Sesuaikan dengan format baru
interface ProkerEntry {
  pekan_ke: string;
  durasi: string;
  keterangan_kegiatan: string;
}

interface ProkerItem {
  id?: string;
  tahun_ajaran: string;
  golongan: string;
  nama_pangkalan: string;
  kegiatan: ProkerEntry[];
}

interface ProkerViewModalProps {
  isOpen: boolean;
  viewData: ProkerItem | null;
  onClose: () => void;
}

export default function ProkerViewModal({ isOpen, viewData, onClose }: ProkerViewModalProps) {
  if (!viewData) return null;

  const handleDirectPrint = () => {
    const printContent = document.getElementById('printable-proker-document');
    if (!printContent) return;

    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=650,toolbar=0,scrollbars=0,status=0');
    if (WindowPrt) {
      WindowPrt.document.write(`
        <html>
          <head>
            <title>Cetak Program Kerja - ${viewData.tahun_ajaran}</title>
            <style>
              @page { size: A4; margin: 20mm; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; }
              .page-container { position: relative; min-height: 250mm; box-sizing: border-box; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h1 { font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
              .header p { font-size: 11px; margin: 4px 0 0 0; font-weight: bold; }
              .meta-info { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 5px; }
              th, td { border: 1px solid #000; padding: 6px 8px; font-size: 10px; text-align: left; vertical-align: middle; }
              th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
              .text-center { text-align: center; }
            </style>
          </head>
          <body>
            <div class="page-container">
              ${printContent.innerHTML}
            </div>
          </body>
        </html>
      `);
      WindowPrt.document.close();
      WindowPrt.focus();
      setTimeout(() => {
        WindowPrt.print();
        WindowPrt.close();
      }, 500);
    }
  };

  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 45,
      align: 'center' as const,
      render: (_: any, __: ProkerEntry, index: number) => <span className="text-xs">{index + 1}</span>,
    },
    {
      title: 'Pekan Ke-',
      dataIndex: 'pekan_ke',
      key: 'pekan_ke',
      width: 100,
      render: (text: string) => <Tag color="indigo" className="font-bold text-xs">{text}</Tag>,
    },
    {
      title: 'Durasi',
      dataIndex: 'durasi',
      key: 'durasi',
      width: 120,
      render: (text: string) => <span className="font-semibold text-xs text-indigo-600">{text}</span>,
    },
    {
      title: 'Keterangan Kegiatan',
      dataIndex: 'keterangan_kegiatan',
      key: 'keterangan_kegiatan',
      render: (text: string) => <span className="text-xs text-slate-900">{text}</span>,
    },
  ];

  const entries = Array.isArray(viewData.kegiatan) ? viewData.kegiatan : [];

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleDirectPrint} className="bg-emerald-600 rounded-xl text-xs font-bold">
          Cetak / PDF
        </Button>,
        <Button key="close" onClick={onClose} className="rounded-xl text-xs">
          Tutup
        </Button>
      ]}
      width={900}
      className="rounded-3xl"
    >
      <div className="bg-white p-4 md:p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-black text-slate-900 tracking-wider uppercase">DETAIL JADWAL & PROGRAM KERJA</h2>
        </div>

        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
          <div><strong className="text-slate-600">Pangkalan:</strong> {viewData.nama_pangkalan}</div>
          <div className="flex gap-4">
            <div><strong className="text-slate-600">Tahun Ajaran:</strong> {viewData.tahun_ajaran}</div>
            <div><strong className="text-slate-600">Golongan:</strong> <Tag color="blue" className="ml-1">{viewData.golongan}</Tag></div>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-[60vh] overflow-y-auto">
          <Table 
            dataSource={entries} 
            columns={columns} 
            rowKey={(record, index) => `${record.pekan_ke}-${index}`}
            pagination={false}
            size="small"
          />
        </div>
      </div>

      {/* TEMPLATE CETAK RESMI */}
      <div id="printable-proker-document" className="hidden">
        <div>
          <div className="header">
            <h1>RANCANGAN PROGRAM KERJA & JADWAL LATIHAN</h1>
            <p>{viewData.nama_pangkalan.toUpperCase()}</p>
          </div>

          <div className="meta-info">
            <div>TAHUN AJARAN: {viewData.tahun_ajaran} | GOLONGAN: {viewData.golongan.toUpperCase()}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>No</th>
                <th style={{ width: '90px' }}>Pekan</th>
                <th style={{ width: '110px' }}>Durasi</th>
                <th>Keterangan Kegiatan</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#666' }}>Tidak ada data program kerja.</td>
                </tr>
              ) : (
                entries.map((item, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}.</td>
                    <td className="text-center"><strong>{item.pekan_ke}</strong></td>
                    <td className="text-center">{item.durasi}</td>
                    <td>{item.keterangan_kegiatan}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}