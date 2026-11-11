'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { message } from 'antd';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { authService, UserSessionData } from '@/lib/auth';
import { attendanceService } from '@/services/attendanceService';
import { AttendanceRecord } from '@/types/attendance';
import RecentScansList from './components/RecentScansList';

const NativeQrScanner = dynamic(() => import('./components/NativeQrScanner'), {
  ssr: false,
});

export default function ScanPage() {
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<AttendanceRecord[]>([]);
  const [lastScannedResult, setLastScannedResult] = useState<AttendanceRecord | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // State Modal & Absen Massal
  const [showManualModal, setShowManualModal] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<{ [studentId: string]: string }>({});
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [attendanceState, setAttendanceState] = useState<{ [studentId: string]: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir' }>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);

  useEffect(() => {
    initSessionAndData();
  }, []);

  const initSessionAndData = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setCurrentUser(user);

      const history = await attendanceService.getUniqueRecentAttendance(5);
      
      // Filter unik agar 1 siswa tidak duplikat di list awal, ambil 5 teratas
      const uniqueMap = new Map();
      for (const item of history) {
        if (!uniqueMap.has(item.student_id)) {
          uniqueMap.set(item.student_id, item);
        }
      }
      setRecentScans(Array.from(uniqueMap.values()).slice(0, 5));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (processing || !currentUser) return;

      try {
        setProcessing(true);
        setScanError(null);

        const result = await attendanceService.recordAttendanceByQr({
          qr_code_id: decodedText,
          recorded_by: currentUser.id,
          status: 'Hadir',
        });

        setLastScannedResult(result);
        
        // Masukkan ke recentScans tanpa duplikat (pindah ke atas)
        setRecentScans((prev) => {
          const filtered = prev.filter((item) => item.student_id !== result.student_id);
          return [result, ...filtered].slice(0, 5);
        });
      } catch (err: any) {
        setScanError(err?.message || 'Gagal memproses QR Code');
      } finally {
        setTimeout(() => setProcessing(false), 2000);
      }
    },
    [processing, currentUser]
  );

  // Buka Modal & Ambil Data Siswa + Status Absen Hari Ini
  const handleOpenManualModal = async () => {
    setShowManualModal(true);
    try {
      setLoadingStudents(true);
      
      const [allStudents, todayRecords] = await Promise.all([
        attendanceService.getAllStudents(),
        attendanceService.getTodayAttendanceRecords()
      ]);

      setStudents(allStudents);

      const map: { [id: string]: string } = {};
      todayRecords.forEach((rec: any) => {
        map[rec.student_id] = rec.status;
      });
      setTodayAttendanceMap(map);

      if (allStudents.length > 0 && !selectedClass) {
        const firstClass = allStudents[0].class_name || '';
        setSelectedClass(firstClass);
        initDefaultAttendance(allStudents, firstClass, map);
      }
    } catch (err) {
      console.error(err);
      message.error('Gagal memuat daftar anggota.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const initDefaultAttendance = (allStudents: any[], className: string, attendanceMap: { [id: string]: string }) => {
    const filtered = allStudents.filter(s => s.class_name === className);
    const initialMap: { [key: string]: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir' } = {};
    filtered.forEach(s => {
      initialMap[s.id] = (attendanceMap[s.id] as any) || 'Hadir';
    });
    setAttendanceState(initialMap);
  };

  const classOptions = useMemo(() => {
    const classes = students.map((s) => s.class_name).filter(Boolean);
    return Array.from(new Set(classes));
  }, [students]);

  const studentsInClass = useMemo(() => {
    return students.filter(s => s.class_name === selectedClass);
  }, [students, selectedClass]);

  const handleClassChange = (className: string) => {
    setSelectedClass(className);
    initDefaultAttendance(students, className, todayAttendanceMap);
  };

  const handleStatusChange = (studentId: string, status: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir') => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmitBatch = async () => {
    if (!currentUser) return;

    try {
      setSubmittingBatch(true);
      const recordsToInsert = Object.keys(attendanceState).map(studentId => ({
        student_id: studentId,
        recorded_by: currentUser.id,
        status: attendanceState[studentId],
      }));

      if (recordsToInsert.length === 0) {
        message.warning('Tidak ada data siswa untuk disimpan.');
        return;
      }

      await attendanceService.recordBatchAttendance(recordsToInsert);

      // Ambil riwayat terbaru & filter unik agar tidak duplikat
      const history = await attendanceService.getRecentAttendance(20);
      const uniqueMap = new Map();
      for (const item of history) {
        if (!uniqueMap.has(item.student_id)) {
          uniqueMap.set(item.student_id, item);
        }
      }
      setRecentScans(Array.from(uniqueMap.values()).slice(0, 5));

      message.success(`Berhasil memperbarui presensi massal untuk Kelas ${selectedClass}!`);
      setShowManualModal(false);
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Gagal menyimpan presensi massal.');
    } finally {
      setSubmittingBatch(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl shadow-lg border border-slate-100">
          <span className="animate-spin text-2xl">⚡</span>
          <span className="text-sm font-bold text-slate-700">Menyiapkan Scanner Kamera...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <Header 
          title="Scan QR Presensi Anggota" 
          subtitle="Arahkan Kamera ke QR Code NTA / ID Anggota Penggalang" 
        />

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Kendala Kamera atau QR Code?</h2>
            <p className="text-xs text-slate-500">Gunakan absensi massal per kelas untuk koreksi titip absen / input manual</p>
          </div>

          <button
            onClick={handleOpenManualModal}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-3 rounded-2xl transition shadow-sm flex items-center gap-2 shrink-0"
          >
            <span>📋 Absen Massal per Kelas</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NativeQrScanner
            onScanSuccess={handleScanSuccess}
            processing={processing}
            scanError={scanError}
            lastScannedResult={lastScannedResult}
          />

          <RecentScansList recentScans={recentScans} />
        </div>

        {/* ========================================== */}
        {/* ✨ MODAL ABSEN MASSAL & KOREKSI TITIP ABSEN */}
        {/* ========================================== */}
        {showManualModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto flex flex-col">
              
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-slate-900">📋 Presensi Massal & Koreksi Kehadiran</h3>
                  <p className="text-xs text-slate-500">Siswa yang sudah scan QR ditandai gradient warna lembut</p>
                </div>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Pilihan Kelas */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pilih Kelas</label>
                <select
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 font-bold text-slate-700"
                >
                  {classOptions.map((cls, idx) => (
                    <option key={idx} value={cls}>
                      Kelas {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* List Siswa */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 flex-1 border-t border-b border-slate-100 py-3">
                {loadingStudents ? (
                  <div className="text-center py-8 text-xs text-slate-400 animate-pulse">
                    Memuat daftar siswa...
                  </div>
                ) : studentsInClass.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Tidak ada siswa ditemukan di kelas ini.
                  </div>
                ) : (
                  studentsInClass.map((student) => {
                    const currentStatus = attendanceState[student.id] || 'Hadir';
                    const alreadyScannedStatus = todayAttendanceMap[student.id];

                    return (
                      <div 
                        key={student.id} 
                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-2xl border transition ${
                          alreadyScannedStatus 
                            ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-emerald-300' // Gradient 25-50% transparan untuk yang sudah scan
                            : 'bg-slate-50 border-slate-200/60'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                            {student.full_name}
                            {alreadyScannedStatus && (
                              <span className="text-[9px] font-extrabold uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                ✓ Sudah Absen ({alreadyScannedStatus})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">Regu: {student.group_name || '-'}</div>
                        </div>
                        
                        {/* Tombol Status */}
                        <div className="flex items-center gap-1 bg-white/80 p-1 rounded-xl shadow-sm border border-slate-200/50 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Hadir')}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded-lg transition ${
                              currentStatus === 'Hadir'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Hadir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Izin')}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded-lg transition ${
                              currentStatus === 'Izin'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Izin
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Sakit')}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded-lg transition ${
                              currentStatus === 'Sakit'
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Sakit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Tidak Hadir')}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded-lg transition ${
                              currentStatus === 'Tidak Hadir'
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Tidak Hadir
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Aksi Simpan */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={submittingBatch || studentsInClass.length === 0}
                  onClick={handleSubmitBatch}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {submittingBatch ? 'Menyimpan...' : `💾 Simpan Presensi Kelas ${selectedClass}`}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}