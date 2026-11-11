'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Button } from 'antd';
import { FileExcelOutlined, PrinterOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx-js-style';
import Header from '@/components/Header'; // Sesuaikan path import Header jika berbeda

export default function LaporanNilaiPage() {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // State untuk Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setReportData([
        { id: '1', 'Nama Lengkap': 'Raihan', 'Kelas': '7B', 'Predikat Nilai': 'D', 'Keterangan': 'Kurang Aktif Saat Mengikuti Kegiatan' },
        { id: '2', 'Nama Lengkap': 'Farhan', 'Kelas': '7A', 'Predikat Nilai': 'D', 'Keterangan': 'Kurang Aktif Saat Mengikuti Kegiatan' },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  // Ambil daftar kelas unik untuk pilihan dropdown filter
  const classOptions = Array.from(new Set(reportData.map((item) => item.Kelas))).filter(Boolean);

  // Data siswa yang sudah difilter berdasarkan pencarian dan kelas
  const filteredData = reportData.filter((item) => {
    const matchesSearch = item['Nama Lengkap'].toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'ALL' || item.Kelas === selectedClass;
    return matchesSearch && matchesClass;
  });

  // Fungsi helper untuk menentukan Tahun Ajaran dan Semester secara otomatis (Juli - Juni)
  const getAcademicPeriod = () => {
    const now = new Date();
    const month = now.getMonth(); 
    const year = now.getFullYear();

    let semester = '';
    let tahunAjaran = '';

    if (month >= 6) {
      semester = 'SEMESTER GANJIL';
      tahunAjaran = `${year} - ${year + 1}`;
    } else {
      semester = 'SEMESTER GENAP';
      tahunAjaran = `${year - 1} - ${year}`;
    }

    return { semester, tahunAjaran };
  };

  // Fungsi Export Excel Full Times New Roman, Border Tabel, & Tanda Tangan Rata Kiri
  const handleExportExcel = () => {
    // Export menggunakan data yang sedang tampil/difilter atau semua data
    const dataToExport = filteredData.length > 0 ? filteredData : reportData;
    if (dataToExport.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const { semester, tahunAjaran } = getAcademicPeriod();

    // 1. Baris Judul
    const excelRows = [
      ["DAFTAR HADIR PRAMUKA"],
      [semester],
      ["SD NEGERI BENCONGAN III"],
      [`TAHUN AJARAN ${tahunAjaran}`],
      [""], 
      ["NO", "NAMA SISWA", "KELAS", "NILAI", "DESKRIPSI"] 
    ];

    // 2. Data Siswa
    dataToExport.forEach((row, index) => {
      excelRows.push([
        index + 1,
        row['Nama Lengkap'],
        row['Kelas'],
        row['Predikat Nilai'],
        row['Keterangan']
      ]);
    });

    // 3. Buat worksheet dari array
    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);

    // 4. Atur Merge Cell untuk Judul
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, 
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, 
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, 
      { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, 
    ];

    // 5. Hitung baris terakhir data siswa untuk posisi tanda tangan di bawah
    const lastRowIndex = excelRows.length;
    const signStartRow = lastRowIndex + 3; 

    // 6. Masukkan Tanda Tangan mulai dari Kolom E
    XLSX.utils.sheet_add_aoa(worksheet, [
      ["Tangerang, " + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
      ["Pembina"],
      [""],
      [""],
      [""], 
      ["___________________________"]
    ], { origin: `E${signStartRow}` });

    // 7. 🌟 Terapkan Font "Times New Roman", Alignment, & Border HANYA pada Tabel Saja
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:E1');
    
    const thinBorder = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const lastTableDataRow = signStartRow - 2;

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        
        if (!worksheet[cellAddress]) continue;

        const isHeaderTitle = R >= 0 && R <= 3; 
        const isTableColumnHeader = R === 5;    
        const isTableData = R >= 6 && R <= lastTableDataRow; 
        const isSignatureArea = R >= signStartRow;      

        if (isSignatureArea) {
          worksheet[cellAddress].s = {
            font: { name: 'Times New Roman', sz: 11 },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: undefined
          };
        } else {
          worksheet[cellAddress].s = {
            font: {
              name: 'Times New Roman',
              sz: isHeaderTitle ? 14 : 11,
              bold: isHeaderTitle || isTableColumnHeader
            },
            alignment: {
              horizontal: isHeaderTitle || isTableColumnHeader ? 'center' : (C === 0 || C === 2 || C === 3 ? 'center' : 'left'),
              vertical: 'center'
            },
            border: (isTableColumnHeader || isTableData) ? thinBorder : undefined
          };
        }
      }
    }

    // 8. Atur Lebar Kolom
    worksheet['!cols'] = [
      { wch: 6 },   
      { wch: 30 },  
      { wch: 10 },  
      { wch: 10 },  
      { wch: 40 },  
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Rekap_Nilai_Pramuka_${dateStr}.xlsx`);
  };

  const columns = [
    { title: 'No', dataIndex: 'index', key: 'index', render: (_: any, __: any, index: number) => index + 1, width: 60, align: 'center' as const },
    { title: 'Nama Siswa', dataIndex: 'Nama Lengkap', key: 'Nama Lengkap' },
    { title: 'Kelas', dataIndex: 'Kelas', key: 'Kelas', width: 90, align: 'center' as const },
    { title: 'Nilai', dataIndex: 'Predikat Nilai', key: 'Predikat Nilai', width: 80, align: 'center' as const },
    { title: 'Deskripsi', dataIndex: 'Keterangan', key: 'Keterangan' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 1. Header Global */}
        <Header 
          title="Laporan Nilai & Kehadiran" 
          subtitle="Sistem Informasi Scout Management • Gugusdepan" 
        />

        {/* 2. Action Bar & Filter Container (Gaya persis halaman manajemen) */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Daftar Rekapitulasi Nilai
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Filter berdasarkan nama siswa atau kelas untuk laporan
              </p>
            </div>

            <Button 
              type="primary" 
              icon={<FileExcelOutlined />} 
              onClick={handleExportExcel}
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
              className="w-full sm:w-auto hover:!bg-green-700 active:scale-95 text-white text-xs font-bold px-5 h-11 rounded-2xl shadow-lg shadow-green-200 transition flex items-center justify-center gap-2"
            >
              Export Excel
            </Button>
          </div>

          {/* Baris Filter & Search Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {/* Input Search Nama */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cari Siswa</label>
              <input
                type="text"
                placeholder="Cari nama siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

            {/* Select Filter Kelas */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Kelas</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              >
                <option value="ALL">Semua Kelas</option>
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 3. Container Utama Tabel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <Card 
            className="rounded-2xl shadow-none border border-slate-100 overflow-hidden" 
            styles={{ body: { padding: 0 } }}
          >
            <Table 
              dataSource={filteredData} 
              columns={columns} 
              rowKey={(record) => record.id || record.nis || record.student_id || `${record['Nama Lengkap']}-${record['Kelas']}`}
              loading={loading}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 800 }}
            />
          </Card>
        </div>

      </div>
    </div>
  );
}