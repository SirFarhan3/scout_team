'use client';

import React from 'react';
import { Modal, Button, Table } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { LogEntry } from '@/types/log-harian';

interface LogViewModalProps {
  isOpen: boolean;
  viewData: { tanggal: string; entries: LogEntry[] };
  onClose: () => void;
  onPrint: () => void;
}

export default function LogViewModal({ isOpen, viewData, onClose, onPrint }: LogViewModalProps) {
  
  // Fungsi cetak bersih dengan format resmi
  const handleDirectPrint = () => {
    const printContent = document.getElementById('printable-official-document');
    if (!printContent) return;

    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=650,toolbar=0,scrollbars=0,status=0');
    if (WindowPrt) {
      WindowPrt.document.write(`
        <html>
          <head>
            <title>Cetak Log Book - ${viewData.tanggal}</title>
            <style>
              @page {
                size: A4;
                margin: 20mm;
              }
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 0; 
                color: #000; 
                background: #fff; 
              }
              .page-container {
                position: relative;
                min-height: 250mm;
                box-sizing: border-box;
              }
              .header { text-align: center; margin-bottom: 20px; }
              .header h1 { font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
              
              .date-label {
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 6px;
                text-align: left;
              }

              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #000; padding: 8px 12px; font-size: 11px; text-align: left; vertical-align: top; }
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

  // Konfigurasi kolom untuk Ant Design Table di Modal Preview Web
  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: LogEntry, index: number) => <span className="font-semibold text-slate-600 text-xs">{index + 1}</span>,
    },
    {
      title: 'Waktu',
      dataIndex: 'waktu',
      key: 'waktu',
      width: 130,
      render: (waktu: string) => <span className="font-semibold text-indigo-600 text-xs">{waktu || '-'}</span>,
    },
    {
      title: 'Kegiatan',
      dataIndex: 'kegiatan',
      key: 'kegiatan',
      render: (kegiatan: string) => <span className="text-slate-800 text-xs">{kegiatan || '-'}</span>,
    },
  ];

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button 
          key="print" 
          type="primary" 
          icon={<PrinterOutlined />} 
          onClick={handleDirectPrint} 
          className="bg-emerald-600 rounded-xl text-xs font-bold"
        >
          Cetak / PDF
        </Button>,
        <Button 
          key="close" 
          onClick={onClose} 
          className="rounded-xl text-xs"
        >
          Tutup
        </Button>
      ]}
      width={800}
      className="rounded-3xl"
    >
      {/* --- 1. TAMPILAN VIEW DI WEB (Menggunakan Ant Design Table) --- */}
      <div className="bg-white p-4 md:p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-black text-slate-900 tracking-wider uppercase">PREVIEW LOG BOOK</h2>
        </div>

        <div className="text-xs font-bold text-slate-700 uppercase">
          Tanggal: {viewData.tanggal ? dayjs(viewData.tanggal).format('DD MMMM YYYY') : ''}
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <Table 
            dataSource={viewData.entries} 
            columns={columns} 
            // PERBAIKAN DI SINI: Menggunakan kombinasi waktu dan kegiatan untuk rowKey tanpa parameter index
            rowKey={(record) => `${record.waktu}-${record.kegiatan}`}
            pagination={viewData.entries.length > 10 ? { pageSize: 10, size: 'small' } : false}
            size="small"
            className="text-xs"
          />
        </div>
      </div>

      {/* --- 2. TEMPLATE KERTAS RESMI (Format Cetak / PDF) --- */}
      <div id="printable-official-document" className="hidden">
        <div>
          <div className="header">
            <h1>LOG BOOK</h1>
          </div>

          <div className="date-label">
            Tanggal: {viewData.tanggal ? dayjs(viewData.tanggal).format('DD MMMM YYYY') : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>No</th>
                <th style={{ width: '120px' }}>Waktu</th>
                <th>Kegiatan</th>
              </tr>
            </thead>
            <tbody>
              {viewData.entries.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: '#666' }}>Tidak ada data kegiatan.</td>
                </tr>
              ) : (
                viewData.entries.map((item, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}.</td>
                    <td>{item.waktu || '-'}</td>
                    <td>{item.kegiatan || '-'}</td>
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