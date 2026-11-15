'use client';

import React from 'react';
import { Modal, Button, Table, Tag } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { ProkerItem } from '@/types/program-kerja';

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
              @page {
                size: A4;
                margin: 1.5cm;
              }
              body {
                font-family: 'Times New Roman', Times, serif;
                color: #000;
                margin: 0;
                padding: 0;
              }
              .page-container {
                width: 100%;
              }
              .header {
                text-align: center;
                margin-bottom: 24px;
                border-bottom: 2px solid #000;
                padding-bottom: 12px;
              }
              .header h1 {
                font-size: 15pt;
                font-weight: bold;
                margin: 0 0 4px 0;
                text-transform: uppercase;
              }
              .header p {
                font-size: 11pt;
                margin: 0;
              }
              .meta-info {
                font-size: 11pt;
                font-weight: bold;
                margin-bottom: 16px;
                display: flex;
                justify-content: space-between;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 24px;
              }
              th, td {
                border: 1px solid #000;
                padding: 6px 10px;
                font-size: 11pt;
                vertical-align: top;
              }
              th {
                background-color: #f2f2f2;
                font-weight: bold;
                text-align: center;
              }
              .text-center {
                text-align: center;
              }
              .footer {
                margin-top: 32px;
                display: flex;
                justify-content: flex-end;
              }
              .signature {
                text-align: center;
                width: 250px;
                font-size: 11pt;
              }
              .signature-space {
                height: 70px;
              }
              .signature-line {
                border-bottom: 1px solid #000;
                margin-bottom: 4px;
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      WindowPrt.document.close();
      WindowPrt.focus();
      setTimeout(() => {
        WindowPrt.print();
        WindowPrt.close();
      }, 350);
    }
  };

  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 50,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => <span className="text-xs font-semibold">{index + 1}</span>,
    },
    {
      title: 'Pekan',
      dataIndex: 'pekan_ke',
      key: 'pekan_ke',
      width: 120,
      render: (text: string) => <strong className="text-slate-800 text-xs">{text}</strong>,
    },
    {
      title: 'Durasi',
      dataIndex: 'durasi',
      key: 'durasi',
      width: 140,
      render: (text: string) => <span className="font-mono text-xs text-indigo-600 font-bold">{text}</span>,
    },
    {
      title: 'Keterangan Kegiatan',
      dataIndex: 'keterangan_kegiatan',
      key: 'keterangan_kegiatan',
      render: (text: string) => <span className="text-slate-700 text-xs">{text}</span>,
    },
  ];

  const entries = Array.isArray(viewData.kegiatan) ? viewData.kegiatan : [];

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose} className="rounded-xl text-xs h-10 px-5">
          Tutup
        </Button>,
        <Button 
          key="print" 
          type="primary" 
          icon={<PrinterOutlined />} 
          onClick={handleDirectPrint}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold h-10 px-6 shadow-md shadow-indigo-100"
        >
          Cetak Dokumen
        </Button>
      ]}
      width={850}
      className="rounded-3xl"
    >
      {/* 1. TAMPILAN INTERAKTIF PADA MODAL SCREEN */}
      <div className="space-y-4 pt-2">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-black text-slate-900 uppercase">Rancangan Program Kerja</h2>
          <p className="text-xs text-slate-400 font-medium">{viewData.nama_pangkalan}</p>
        </div>

        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60 text-xs flex justify-between items-center">
          <div className="flex gap-4">
            <div><strong className="text-slate-600">Tahun Ajaran:</strong> {viewData.tahun_ajaran}</div>
            <div><strong className="text-slate-600">Golongan:</strong> <Tag color="blue" className="ml-1">{viewData.golongan}</Tag></div>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-[60vh] overflow-y-auto">
          <Table 
            dataSource={entries} 
            columns={columns} 
            rowKey={(record) => `${record.pekan_ke}-${record.durasi}-${record.keterangan_kegiatan}`}
            pagination={false}
            size="small"
          />
        </div>
      </div>

      {/* 2. TEMPLATE CETAK RESMI FORMAT KERTAS A4 */}
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

          <div className="footer">
            <div className="signature">
              <div>Tangerang, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div>Pembina Satuan,</div>
              <div className="signature-space"></div>
              <div className="signature-line"></div>
              <div>NTA. ................................</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
