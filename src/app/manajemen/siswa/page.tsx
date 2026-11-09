'use client';

import { useEffect, useState, useMemo } from 'react';
import Header from '@/components/Header';
import { authService } from '@/lib/auth';
import { studentService } from '@/services/studentService';
import { Student, CreateStudentInput } from '@/types/student';
import StudentForm from './components/StudentForm';

export default function StudentManagementPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // State Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedGroup, setSelectedGroup] = useState('ALL');

  useEffect(() => {
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
    } catch (error: any) {
      alert(`Gagal menambah siswa: ${error?.message || 'Terjadi kesalahan'}`);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl shadow-lg border border-slate-100">
          <span className="animate-spin text-2xl">⚡</span>
          <span className="text-sm font-bold text-slate-700">Memuat Data...</span>
        </div>
      </div>
    );
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

            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
            >
              {showForm ? '❌ Batal' : '➕ Tambah Anggota'}
            </button>
          </div>

          {/* Baris Filter & Search Input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {/* Input Search Nama/NTA/QR */}
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

            {/* Select Filter Regu */}
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
        {showForm && (
          <StudentForm
            onSuccess={() => setShowForm(false)}
            onSubmitStudent={handleCreateStudent}
          />
        )}

        {/* Container Utama Putih (Selalu Tampil Sama Baik Kosong Maupun Ada Data) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          {filteredStudents.length === 0 ? (
            /* State Saat Data Kosong / Tidak Ada Hasil Filter */
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
            /* State Saat Ada Data (Grid Card Siswa di Dalam Container Utama) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="bg-slate-50/70 hover:bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-3 transition"
                >
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

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>NTA: {student.nta || '-'}</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold shadow-sm">
                      {student.qr_code_id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}