'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Tag, message } from 'antd';
import { FileExcelOutlined, ReloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx-js-style';
import Header from '@/components/Header';
import { authService } from '@/lib/auth';
import { attendanceService } from '@/services/attendanceService';

interface ReportRow {
  id?: string;
  No?: number;
  'Nama Lengkap': string;
  Kelas: string;
  Regu?: string;
  NTA?: string;
  'Total Hadir': number;
  'Total Izin': number;
  'Total Sakit': number;
  'Total Tidak Hadir': number;
  'Total Pertemuan'?: number;
  Persentase?: string;
  'Persentase Angka'?: number;
  'Predikat Nilai': string;
  Keterangan: string;
}

export default function LaporanNilaiPage() {
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  // State untuk Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const data = await attendanceService.getAttendanceReportForExport();
      setReportData(data as ReportRow[]);
    } catch (err: any) {
      console.error('Error fetching report data:', err);
      message.error(err.message || 'Gagal memuat rekap nilai siswa dari database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      if (!user) {
        window.location.href = '/login';
        return;
      }
      fetchReportData();
    });
  }, []);

  // Ambil daftar kelas unik untuk pilihan dropdown filter
  const classOptions = Array.from(new Set(reportData.map((item) => item.Kelas)))
    .filter(Boolean)
    .sort();

  // Data siswa yang sudah difilter berdasarkan pencarian dan kelas
  const filteredData = reportData.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item['Nama Lengkap'].toLowerCase().includes(query) ||
      (item.Regu && item.Regu.toLowerCase().includes(query)) ||
      (item.NTA && item.NTA.toLowerCase().includes(query));
    const matchesClass = selectedClass === 'ALL' || item.Kelas === selectedClass;
    return matchesSearch && matchesClass;
  });

  // Hitung total sesi pertemuan unik terlaksana dari data
  const totalSessionsHeld = reportData.length > 0
    ? Math.max(...reportData.map((r) => r['Total Pertemuan'] ?? 0), 0)
    : 0;

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
    const dataToExport = filteredData.length > 0 ? filteredData : reportData;
    if (dataToExport.length === 0) {
      message.warning('Tidak ada data untuk diexport.');
      return;
    }

    const { semester, tahunAjaran } = getAcademicPeriod();

    // 1. Baris Judul
    const excelRows: (string | number)[][] = [
      ["DAFTAR HADIR & REKAP NILAI PRAMUKA"],
      [semester],
      ["SD NEGERI BENCONGAN III"],
      [`TAHUN AJARAN ${tahunAjaran}`],
      [""], 
      ["NO", "NAMA SISWA", "KELAS", "REGU", "TOTAL HADIR", "TOTAL PERTEMUAN", "PERSENTASE", "NILAI", "DESKRIPSI"] 
    ];

    // 2. Data Siswa
    dataToExport.forEach((row, index) => {
      excelRows.push([
        index + 1,
        row['Nama Lengkap'],
        row['Kelas'],
        row['Regu'] || '-',
        row['Total Hadir'] ?? 0,
        row['Total Pertemuan'] ?? 0,
        row.Persentase || '0%',
        row['Predikat Nilai'],
        row['Keterangan']
      ]);
    });

    // 3. Buat worksheet dari array
    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);

    // 4. Atur Merge Cell untuk Judul
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, 
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, 
      { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }, 
      { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }, 
    ];

    // 5. Hitung baris terakhir data siswa untuk posisi tanda tangan di bawah
    const lastRowIndex = excelRows.length;
    const signStartRow = lastRowIndex + 3; 

    // 6. Masukkan Tanda Tangan mulai dari Kolom H (indeks 7)
    XLSX.utils.sheet_add_aoa(worksheet, [
      ["Tangerang, " + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
      ["Pembina Pramuka"],
      [""],
      [""],
      [""], 
      ["___________________________"]
    ], { origin: `H${signStartRow}` });

    // 7. 🌟 Terapkan Font "Times New Roman", Alignment, & Border HANYA pada Tabel Saja
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:I1');
    
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
              horizontal: isHeaderTitle || isTableColumnHeader ? 'center' : (C === 0 || C === 2 || C === 3 || C === 4 || C === 5 || C === 6 || C === 7 ? 'center' : 'left'),
              vertical: 'center'
            },
            border: (isTableColumnHeader || isTableData) ? thinBorder : undefined
          };
        }
      }
    }

    // 8. Atur Lebar Kolom
    worksheet['!cols'] = [
      { wch: 6 },   // No
      { wch: 28 },  // Nama
      { wch: 10 },  // Kelas
      { wch: 16 },  // Regu
      { wch: 12 },  // Total Hadir
      { wch: 16 },  // Total Pertemuan
      { wch: 14 },  // Persentase
      { wch: 10 },  // Nilai
      { wch: 40 },  // Deskripsi
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Rekap_Nilai_Pramuka_${dateStr}.xlsx`);
    message.success('Berhasil mengunduh Rekap Nilai ke Excel!');
  };

  const getPredicateBadge = (val: string) => {
    switch (val) {
      case 'A':
        return <Tag color="green" className="font-bold text-xs px-2 py-0.5 rounded-md">A</Tag>;
      case 'B':
        return <Tag color="blue" className="font-bold text-xs px-2 py-0.5 rounded-md">B</Tag>;
      case 'C':
        return <Tag color="orange" className="font-bold text-xs px-2 py-0.5 rounded-md">C</Tag>;
      case 'D':
      default:
        return <Tag color="red" className="font-bold text-xs px-2 py-0.5 rounded-md">D</Tag>;
    }
  };

  const columns = [
    { 
      title: 'No', 
      dataIndex: 'index', 
      key: 'index', 
      render: (_: any, __: any, index: number) => index + 1, 
      width: 60, 
      align: 'center' as const 
    },
    { 
      title: 'Nama Siswa', 
      dataIndex: 'Nama Lengkap', 
      key: 'Nama Lengkap',
      render: (val: string, record: ReportRow) => (
        <div>
          <span className="font-semibold text-slate-800">{val}</span>
          {record.NTA && record.NTA !== '-' && (
            <span className="block text-[11px] text-slate-400">NTA: {record.NTA}</span>
          )}
        </div>
      ),
    },
    { 
      title: 'Kelas', 
      dataIndex: 'Kelas', 
      key: 'Kelas', 
      width: 90, 
      align: 'center' as const,
      render: (val: string) => <span className="font-medium text-slate-600">{val}</span>
    },
    { 
      title: 'Regu', 
      dataIndex: 'Regu', 
      key: 'Regu', 
      width: 120, 
      align: 'center' as const,
      render: (val: string) => <span className="font-medium text-slate-600">{val || '-'}</span>
    },
    { 
      title: 'Kehadiran', 
      dataIndex: 'Total Hadir', 
      key: 'Total Hadir', 
      width: 130, 
      align: 'center' as const,
      render: (val: number, record: ReportRow) => {
        const totalSabtu = record['Total Pertemuan'] ?? 0;
        return (
          <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
            <strong className="text-emerald-600">{val ?? 0}</strong> / {totalSabtu} Sesi
          </span>
        );
      }
    },
    { 
      title: 'Persentase', 
      dataIndex: 'Persentase', 
      key: 'Persentase', 
      width: 105, 
      align: 'center' as const,
      render: (val: string, record: ReportRow) => {
        const pct = record['Persentase Angka'] ?? 0;
        let color = 'red';
        if (pct >= 85) color = 'green';
        else if (pct >= 75) color = 'blue';
        else if (pct >= 60) color = 'orange';

        return (
          <Tag color={color} className="font-bold text-xs px-2.5 py-0.5 rounded-full">
            {val || '0%'}
          </Tag>
        );
      }
    },
    { 
      title: 'Nilai', 
      dataIndex: 'Predikat Nilai', 
      key: 'Predikat Nilai', 
      width: 80, 
      align: 'center' as const,
      render: (val: string) => getPredicateBadge(val)
    },
    { 
      title: 'Deskripsi', 
      dataIndex: 'Keterangan', 
      key: 'Keterangan',
      render: (val: string) => <span className="text-xs text-slate-600">{val}</span>
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 1. Header Global */}
        <Header 
          title="Laporan Nilai & Kehadiran" 
          subtitle="Sistem Informasi Scout Management • Gugusdepan" 
        />

        {/* 2. Action Bar & Filter Container */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Daftar Rekapitulasi Nilai
                </h2>
                {reportData.length > 0 && (
                  <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                    {totalSessionsHeld} Sesi Sabtu (Acuan)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Total kehadiran dihitung dari seluruh sesi latihan (Sabtu + hari lain) berbanding acuan sesi hari Sabtu
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={fetchReportData}
                disabled={loading}
                className="rounded-2xl h-11 px-4 text-xs font-semibold text-slate-600 hover:text-indigo-600"
              >
                Segarkan
              </Button>
              <Button 
                type="primary" 
                icon={<FileExcelOutlined />} 
                onClick={handleExportExcel}
                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                className="flex-1 sm:flex-initial hover:!bg-green-700 active:scale-95 text-white text-xs font-bold px-5 h-11 rounded-2xl shadow-lg shadow-green-200 transition flex items-center justify-center gap-2"
              >
                Export Excel
              </Button>
            </div>
          </div>

          {/* Baris Filter & Search Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {/* Input Search Nama / Regu / NTA */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cari Siswa / Regu / NTA</label>
              <input
                type="text"
                placeholder="Ketik nama siswa, regu, atau NTA..."
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
                <option value="ALL">Semua Kelas ({reportData.length} Siswa)</option>
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
              rowKey={(record) => record.id || `${record['Nama Lengkap']}-${record.Kelas}-${record.NTA || ''}`}
              loading={loading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} siswa` }}
              scroll={{ x: 800 }}
              locale={{ emptyText: loading ? 'Memuat data...' : 'Tidak ada data rekapitulasi nilai' }}
            />
          </Card>
        </div>

      </div>
    </div>
  );
}
