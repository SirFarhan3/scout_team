'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import Header from '@/components/Header';
import dayjs from 'dayjs';
import { getAllLogs, upsertLog, deleteLog, createLog } from '@/services/logService';
import { LogEntry } from '@/types/log-harian';

// Import Komponen dari Direktori Lokal
import LogTable from './components/LogTable';
import LogFormModal from './components/LogFormModal';
import LogViewModal from './components/LogViewModal';

export default function LogHarianPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [logEntries, setLogEntries] = useState<LogEntry[]>([{ waktu: '', kegiatan: '' }]);
  const [saving, setSaving] = useState(false);

  // Modal View State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<{ tanggal: string; entries: LogEntry[] }>({ tanggal: '', entries: [] });

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getAllLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedDate(dayjs().format('YYYY-MM-DD'));
    setLogEntries([{ waktu: '', kegiatan: '' }]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record: any) => {
    setModalMode('edit');
    setSelectedDate(record.tanggal);
    setLogEntries(Array.isArray(record.kegiatan) ? record.kegiatan : []);
    setIsModalOpen(true);
  };

  const handleOpenView = (record: any) => {
    setViewData({
      tanggal: record.tanggal,
      entries: Array.isArray(record.kegiatan) ? record.kegiatan : []
    });
    setIsViewModalOpen(true);
  };

  const handleAddRow = () => {
    setLogEntries([...logEntries, { waktu: '', kegiatan: '' }]);
  };

  const handleRowChange = (index: number, field: 'waktu' | 'kegiatan', value: string) => {
    const updated = [...logEntries];
    updated[index][field] = value;
    setLogEntries(updated);
  };

  const handleDeleteRow = (index: number) => {
    setLogEntries(logEntries.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedDate) {
      message.error('Silakan pilih tanggal!');
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'create') {
        await createLog(selectedDate, logEntries); // Menolak jika tanggal sudah ada
      } else {
        await upsertLog(selectedDate, logEntries); // Mode edit tetap pakai upsert
      }
      
      message.success('Log harian berhasil disimpan!');
      setIsModalOpen(false); // Modal HANYA tertutup kalau sukses
      fetchLogs();
    } catch (err: any) {
      message.error(err.message); // Pesan error tampil, tapi modal TIDAK tertutup
    } finally {
      setSaving(false);
    }
  };

  // Fungsi Download / Cetak PDF yang disamakan dengan LogViewModal
  const handleDownload = (record: any) => {
    const tanggalFormatted = dayjs(record.tanggal).format('DD MMMM YYYY');
    const entries = Array.isArray(record.kegiatan) ? record.kegiatan : [];

    // Buat baris tabel kegiatan secara dinamis
    const rowsHtml = entries.length === 0 
      ? `<tr><td colspan="3" style="text-align: center; color: #666;">Tidak ada data kegiatan.</td></tr>`
      : entries.map((item: any, i: number) => `
          <tr>
            <td class="text-center">${i + 1}.</td>
            <td>${item.waktu || '-'}</td>
            <td>${item.kegiatan || '-'}</td>
          </tr>
        `).join('');

    const WindowPrt = window.open('', '', 'left=0,top=0,width=900,height=650,toolbar=0,scrollbars=0,status=0');
    if (WindowPrt) {
      WindowPrt.document.write(`
        <html>
          <head>
            <title>Cetak Log Book - ${record.tanggal}</title>
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
              <div class="header">
                <h1>LOG BOOK</h1>
              </div>

              <div class="date-label">
                Tanggal: ${tanggalFormatted}
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 40px;">No</th>
                    <th style="width: 120px;">Waktu</th>
                    <th>Kegiatan</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
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

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Hapus Log Harian',
      content: 'Apakah lu yakin ingin menghapus arsip log tanggal ini?',
      okText: 'Ya, Hapus',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await deleteLog(id);
          message.success('Log berhasil dihapus');
          fetchLogs();
        } catch (err: any) {
          message.error('Gagal menghapus: ' + err.message);
        }
      }
    });
  };

  const filteredLogs = logs.filter(item => 
    item.tanggal.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="print:hidden">
          <Header 
            title="Log Book (Buku Harian)" 
            subtitle="Sistem Informasi Scout Management • Daftar Arsip Kegiatan Harian" 
          />
        </div>

        {/* Bar Kontrol */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Cari tanggal (YYYY-MM-DD)..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="rounded-xl h-10 text-xs"
              allowClear
            />
          </div>

          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 h-10 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
          >
            Buat Log Baru
          </Button>
        </div>

        {/* Tabel Arsip */}
        <LogTable 
          logs={filteredLogs}
          loading={loading}
          onView={handleOpenView}
          onEdit={handleOpenEdit}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />

        {/* Modal Form */}
        <LogFormModal 
          isOpen={isModalOpen}
          mode={modalMode}
          selectedDate={selectedDate}
          logEntries={logEntries}
          saving={saving}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          onDateChange={setSelectedDate}
          onAddRow={handleAddRow}
          onRowChange={handleRowChange}
          onDeleteRow={handleDeleteRow}
        />

        {/* Modal Preview & Print */}
        <LogViewModal 
          isOpen={isViewModalOpen}
          viewData={viewData}
          onClose={() => setIsViewModalOpen(false)}
          onPrint={() => window.print()}
        />

      </div>
    </div>
  );
}