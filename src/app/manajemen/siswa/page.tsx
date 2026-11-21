'use client';

import { useEffect, useState, useMemo } from 'react';
import { App, Segmented } from 'antd';
import { TableOutlined, AppstoreOutlined, QrcodeOutlined } from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import { printStudentQrSheet } from '@/lib/qrBatchDownload';
import { studentService } from '@/services/studentService';
import { Student, CreateStudentInput } from '@/types/student';
import StudentForm from './components/StudentForm';
import StudentTable from './components/StudentTable';
import StudentEditModal from './components/StudentEditModal'; // <--- Import modal edit baru
import StudentQRModal from './components/StudentQRModal';

export default function StudentManagementPage() {
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // State untuk Cetak QR
  const [selectedQRStudent, setSelectedQRStudent] = useState<Student | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // State untuk Cetak QR massal sesuai filter
  const [printingQr, setPrintingQr] = useState(false);

  // State untuk Modal Edit
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // State Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedGroup, setSelectedGroup] = useState('ALL');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('grid');
    }
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      if (user.school && !user.school.subscription_active) {
        window.location.href = '/billing';
        return;
      }
      setCurrentUser(user);
      const data = await studentService.getAllStudents();
      setStudents(data || []);
    } catch (error: any) {
      console.error('Error loading students:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (studentData: CreateStudentInput) => {
    try {
      const newStudent = await studentService.createStudent(studentData);
      setStudents((prev) => [newStudent, ...prev]);
      setShowForm(false);
      message.success('Berhasil menambah siswa baru!');
    } catch (error: any) {
      message.error(`Gagal menambah siswa: ${error?.message || 'Terjadi kesalahan'}`);
    }
  };

  // Handler Tombol Edit di Tabel
  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setIsEditModalOpen(true);
  };

  // Handler setelah berhasil update data dari modal
  const handleUpdateStudentSuccess = (updatedStudent: Student) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
    );
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await studentService.deleteStudent(id);
      
      // Update state lokal supaya barisnya langsung hilang dari tabel tanpa perlu refresh
      setStudents((prev) => prev.filter((s) => s.id !== id));
      message.success('Anggota berhasil dihapus dari database!');
    } catch (error: any) {
      message.error(`Gagal menghapus anggota: ${error?.message || 'Terjadi kesalahan'}`);
    }
  };

  const handlePrintQR = (student: Student) => {
    setSelectedQRStudent(student);
    setIsQRModalOpen(true);
  };

  // List Kelas & Regu unik secara otomatis dari data siswa
  const classOptions = useMemo(() => {
    const classes = students
      .map((s) => s.class_name)
      .filter((c): c is string => Boolean(c));
    return Array.from(new Set(classes));
  }, [students]);

  const groupOptions = useMemo(() => {
    const groups = students
      .map((s) => s.group_name)
      .filter((g): g is string => Boolean(g));
    return Array.from(new Set(groups));
  }, [students]);

  // Filtering siswa berdasarkan Search, Kelas, dan Regu
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.qr_code_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.nta && student.nta.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesClass =
        selectedClass === 'ALL' || student.class_name === selectedClass;

      const matchesGroup =
        selectedGroup === 'ALL' || student.group_name === selectedGroup;

      return matchesSearch && matchesClass && matchesGroup;
    });
  }, [students, searchQuery, selectedClass, selectedGroup]);

  // Cetak QR semua anggota sesuai filter aktif dalam lembar A4 (12 QR / halaman)
  const handlePrintFilteredQr = async () => {
    if (filteredStudents.length === 0) {
      message.warning('Tidak ada anggota pada filter ini.');
      return;
    }

    const filterParts = [
      selectedClass !== 'ALL' ? `Kelas ${selectedClass}` : '',
      selectedGroup !== 'ALL' ? `Regu ${selectedGroup}` : '',
      searchQuery.trim() ? `Cari "${searchQuery.trim()}"` : '',
    ].filter(Boolean);
    const heading = `QR Anggota - ${filterParts.length ? filterParts.join(' - ') : 'Semua'}`;

    try {
      setPrintingQr(true);
      await printStudentQrSheet(filteredStudents, heading);
    } catch (error: any) {
      console.error('Gagal cetak QR massal:', error);
      message.error(error?.message || 'Gagal menyiapkan lembar QR.');
    } finally {
      setPrintingQr(false);
    }
  };

  const canManageStudents =
    currentUser?.role === 'admin' || currentUser?.role === 'pembina';

  if (loading) {
    return <PageLoader text="Memuat Data Anggota Pramuka..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Global */}
        <Header 
          title="Manajemen Anggota Penggalang" 
          subtitle="Sistem Informasi Scout Management • Gugusdepan" 
        />

        {/* Action Bar & Filter Container */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Daftar Anggota
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Filter berdasarkan nama, kelas, atau regu penggalang
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as 'table' | 'grid')}
                options={[
                  { label: 'Tabel', value: 'table', icon: <TableOutlined /> },
                  { label: 'Grid', value: 'grid', icon: <AppstoreOutlined /> },
                ]}
                className="bg-slate-100 p-1 rounded-2xl"
              />

              <button
                onClick={handlePrintFilteredQr}
                disabled={printingQr || filteredStudents.length === 0}
                title="Cetak QR semua anggota sesuai filter (A4, 12 QR per halaman)"
                className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-200 disabled:shadow-none transition flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <QrcodeOutlined />
                {printingQr ? 'Menyiapkan...' : `Cetak QR (${filteredStudents.length})`}
              </button>

              {canManageStudents && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  ➕ Tambah Anggota
                </button>
              )}
            </div>
          </div>

          {/* Baris Filter & Search Input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cari Anggota</label>
              <input
                type="text"
                placeholder="Cari nama, NTA, atau QR ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

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

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Regu</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              >
                <option value="ALL">Semua Regu</option>
                {groupOptions.map((grp) => (
                  <option key={grp} value={grp}>
                    Regu {grp}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Modal Form Tambah Siswa */}
        {canManageStudents && (
          <StudentForm
            open={showForm}
            onClose={() => setShowForm(false)}
            onSuccess={() => setShowForm(false)}
            onSubmitStudent={handleCreateStudent}
          />
        )}

        {/* Modal Form Edit Siswa */}
        <StudentEditModal
          visible={isEditModalOpen}
          student={editingStudent}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingStudent(null);
          }}
          onUpdate={handleUpdateStudentSuccess}
        />

        {/* Tampilan Tabel atau Grid */}
        {viewMode === 'table' ? (
          <StudentTable 
            students={filteredStudents} 
            loading={loading}
            onEdit={canManageStudents ? handleEditStudent : undefined}
            onDelete={canManageStudents ? handleDeleteStudent : undefined}
            onPrintQR={handlePrintQR}
          />
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <span className="text-3xl">🔍</span>
                <p className="text-sm font-semibold text-slate-500">
                  Tidak ada anggota yang cocok dengan filter.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedClass('ALL');
                    setSelectedGroup('ALL');
                  }}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="bg-slate-50/70 hover:bg-slate-50 p-5 rounded-3xl border border-slate-200/80 flex flex-col justify-between space-y-4 transition"
                  >
                    {/* Bagian Informasi Siswa */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-100/70 px-2.5 py-1 rounded-lg">
                            {student.class_name || 'Tanpa Kelas'}
                          </span>
                          <h3 className="font-bold text-slate-900 text-base mt-1.5">
                            {student.full_name}
                          </h3>
                        </div>
                        <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200/60 shadow-sm">
                          {student.group_name}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>NTA: {student.nta || '-'}</span>
                        <span className="bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold text-[10px] shadow-sm">
                          {student.qr_code_id}
                        </span>
                      </div>
                    </div>

                    {/* Tombol Aksi di Kartu Grid */}
                    <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handlePrintQR(student)}
                        className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-2 px-3 rounded-xl transition border border-emerald-200/60 flex items-center justify-center gap-1.5"
                        title="Cetak QR"
                      >
                        <span>🖨️ QR</span>
                      </button>
                      {canManageStudents && (
                        <>
                          <button
                            onClick={() => handleEditStudent(student)}
                            className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold py-2 px-3 rounded-xl transition border border-amber-200/60 flex items-center justify-center gap-1.5"
                            title="Edit Anggota"
                          >
                            <span>✏️ Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold py-2 px-3 rounded-xl transition border border-rose-200/60 flex items-center justify-center"
                            title="Hapus Anggota"
                          >
                            <span>🗑️</span>
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      <StudentQRModal
        visible={isQRModalOpen}
        student={selectedQRStudent}
        onClose={() => {
          setIsQRModalOpen(false);
          setSelectedQRStudent(null);
        }}
      />
      </div>
    </div>
  );
}