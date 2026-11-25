'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { App } from 'antd';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import { attendanceService } from '@/services/attendanceService';
import { AttendanceRecord } from '@/types/attendance';
import { extractQrCodeId } from '@/lib/sanitize';
import {
  OFFLINE_QUEUE_EVENT,
  OFFLINE_SYNC_STATUS_EVENT,
  cacheStudentsForSchool,
  cacheUserForOffline,
  enqueueOfflineScan,
  findCachedStudentByQr,
  getCachedStudents,
  getCachedUserForOffline,
  getOfflineQueue,
  getStudentsCacheInfo,
  isOfflineSyncInProgress,
  syncOfflineAttendanceQueue,
  type OfflineAttendanceQueueItem,
  type SyncQueueResult,
} from '@/lib/offlineAttendance';
import RecentScansList from './components/RecentScansList';

type ManualAttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir';

interface ScanStudentItem {
  id: string;
  full_name: string;
  class_name?: string | null;
  group_name?: string | null;
  qr_code_id?: string | null;
}

const NativeQrScanner = dynamic(() => import('./components/NativeQrScanner'), {
  ssr: false,
});

function isLikelyNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('err_internet_disconnected')
  );
}

function queueItemToAttendanceRecord(item: OfflineAttendanceQueueItem): AttendanceRecord {
  return {
    id: item.client_id,
    student_id: item.student_id,
    recorded_by: item.recorded_by,
    status: item.status,
    created_at: item.scanned_at,
    isOfflinePending: true,
    student: {
      full_name: item.student_name,
      class_name: item.class_name,
      group_name: item.group_name || '-',
      qr_code_id: item.qr_code_id,
    },
  };
}

function mergeRecentWithPending(
  serverRecords: AttendanceRecord[],
  pendingItems: OfflineAttendanceQueueItem[]
): AttendanceRecord[] {
  const uniqueMap = new Map<string, AttendanceRecord>();
  // Prioritaskan item offline terbaru di bagian atas
  const sortedPending = [...pendingItems].sort((a, b) =>
    b.scanned_at.localeCompare(a.scanned_at)
  );
  for (const item of sortedPending) {
    if (!uniqueMap.has(item.student_id)) {
      uniqueMap.set(item.student_id, queueItemToAttendanceRecord(item));
    }
  }
  for (const rec of serverRecords) {
    if (!uniqueMap.has(rec.student_id)) {
      uniqueMap.set(rec.student_id, rec);
    }
  }
  return Array.from(uniqueMap.values()).slice(0, 5);
}

export default function ScanPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<AttendanceRecord[]>([]);
  const [lastScannedResult, setLastScannedResult] = useState<AttendanceRecord | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  // State Offline-First & Auto-Sync
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cachedStudentCount, setCachedStudentCount] = useState(0);
  const [refreshingCache, setRefreshingCache] = useState(false);

  // State Modal & Absen Massal
  const [showManualModal, setShowManualModal] = useState(false);
  const [students, setStudents] = useState<ScanStudentItem[]>([]);
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<{ [studentId: string]: string }>({});
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [attendanceState, setAttendanceState] = useState<{
    [studentId: string]: ManualAttendanceStatus;
  }>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);

  const refreshServerRecent = useCallback(async (schoolId: string) => {
    const pendingItems = await getOfflineQueue(schoolId);
    setPendingCount(pendingItems.length);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const history = await attendanceService.getUniqueRecentAttendance(5);
        setRecentScans(mergeRecentWithPending(history, pendingItems));
        return;
      } catch {
        // Fallback ke tampilan antrean lokal saja
      }
    }
    setRecentScans((prev) => mergeRecentWithPending(prev.filter((r) => !r.isOfflinePending), pendingItems));
  }, []);

  const refreshStudentsCache = useCallback(
    async (schoolId: string, showToast = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (showToast) {
          message.warning('Tidak dapat memperbarui cache siswa saat offline.');
        }
        return;
      }
      try {
        setRefreshingCache(true);
        const allStudents = await attendanceService.getAllStudents();
        const savedCount = await cacheStudentsForSchool(schoolId, allStudents);
        setCachedStudentCount(savedCount);
        if (showToast) {
          message.success(`Cache offline diperbarui (${savedCount} siswa siap scan offline).`);
        }
      } catch {
        if (showToast) {
          message.error('Gagal memperbarui cache daftar siswa.');
        }
      } finally {
        setRefreshingCache(false);
      }
    },
    [message]
  );

  useEffect(() => {
    let cancelled = false;

    const runInit = async () => {
      try {
        const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;

        let user: UserSessionData | null = null;
        if (onlineNow) {
          user = await authService.getCurrentUser();
          if (user) {
            await cacheUserForOffline(user);
          }
        }

        if (!user) {
          user = authService.getCachedUser() || (await getCachedUserForOffline());
        }

        if (cancelled) return;
        setIsOnline(onlineNow);

        if (!user) {
          router.replace('/login');
          return;
        }
        if (user.school && !user.school.subscription_active) {
          router.replace('/billing');
          return;
        }

        setCurrentUser(user);
        const schoolId = user.school_id || '';

        if (schoolId) {
          const [cacheInfo, pendingItems] = await Promise.all([
            getStudentsCacheInfo(schoolId),
            getOfflineQueue(schoolId),
          ]);
          if (cancelled) return;
          setCachedStudentCount(cacheInfo.count);
          setPendingCount(pendingItems.length);
          setIsSyncing(isOfflineSyncInProgress());

          if (onlineNow) {
            const [history] = await Promise.all([
              attendanceService.getUniqueRecentAttendance(5).catch(() => []),
              refreshStudentsCache(schoolId, false),
            ]);
            if (cancelled) return;
            setRecentScans(mergeRecentWithPending(history, pendingItems));

            if (pendingItems.length > 0) {
              void syncOfflineAttendanceQueue(schoolId);
            }
          } else {
            setRecentScans(mergeRecentWithPending([], pendingItems));
          }
        }
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void runInit();
    return () => {
      cancelled = true;
    };
  }, [refreshStudentsCache, router]);

  // Dengarkan perubahan status jaringan & hasil auto-sync global
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser?.school_id) return;
    const schoolId = currentUser.school_id;

    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleQueueChanged = () => {
      void getOfflineQueue(schoolId).then((items) => setPendingCount(items.length));
    };
    const handleSyncStatus = (event: Event) => {
      const custom = event as CustomEvent<{ syncing: boolean; lastResult?: SyncQueueResult }>;
      setIsSyncing(Boolean(custom.detail?.syncing));
      const res = custom.detail?.lastResult;
      if (!custom.detail?.syncing && res) {
        if (res.syncedCount > 0) {
          message.success({
            content: `✅ ${res.syncedCount} presensi offline berhasil disinkronkan ke server!`,
            duration: 4,
          });
          void refreshServerRecent(schoolId);
        } else if (res.skippedCount > 0) {
          void refreshServerRecent(schoolId);
        } else if (res.authRequired) {
          message.warning({
            content:
              'Sesi login berakhir. Antrean offline tetap aman — silakan login ulang untuk sinkronisasi.',
            duration: 5,
          });
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
    window.addEventListener(OFFLINE_SYNC_STATUS_EVENT, handleSyncStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
      window.removeEventListener(OFFLINE_SYNC_STATUS_EVENT, handleSyncStatus);
    };
  }, [currentUser?.school_id, message, refreshServerRecent]);

  const handleManualSync = async () => {
    if (!currentUser?.school_id) return;
    if (!navigator.onLine) {
      message.warning('Masih offline. Sinkronisasi akan berjalan otomatis saat internet kembali.');
      return;
    }
    const result = await syncOfflineAttendanceQueue(currentUser.school_id);
    if (result.error) {
      message.error(result.error);
    } else if (result.syncedCount === 0 && result.skippedCount === 0 && result.remainingCount === 0) {
      message.info('Semua data presensi sudah tersinkron.');
    }
  };

  const recordOfflineLocally = useCallback(
    async (extractedQr: string, user: UserSessionData) => {
      const schoolId = user.school_id || '';
      const cachedStudent = await findCachedStudentByQr(schoolId, extractedQr);

      if (!cachedStudent) {
        throw new Error(
          cachedStudentCount === 0
            ? 'Mode offline aktif, tetapi cache daftar siswa masih kosong. Buka halaman Scan saat online terlebih dahulu.'
            : `QR "${extractedQr}" tidak ditemukan di data siswa offline sekolah Anda.`
        );
      }

      const { item, duplicate } = await enqueueOfflineScan({
        schoolId,
        student: cachedStudent,
        recordedBy: user.id,
        status: 'Hadir',
      });

      const offlineRecord: AttendanceRecord = {
        ...queueItemToAttendanceRecord(item),
        alreadyRecorded: duplicate,
      };

      setLastScannedResult(offlineRecord);

      if (duplicate) {
        message.warning({
          content: `${cachedStudent.full_name} sudah tercatat di antrean offline hari ini!`,
          duration: 3,
        });
      } else {
        message.success({
          content: `📥 Tersimpan Offline: ${cachedStudent.full_name} (auto-sync saat online)`,
          duration: 3,
        });
      }

      setRecentScans((prev) => {
        const filtered = prev.filter((r) => r.student_id !== offlineRecord.student_id);
        return [offlineRecord, ...filtered].slice(0, 5);
      });
    },
    [cachedStudentCount, message]
  );

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      // Tetap bisa scan meskipun isSyncing === true (non-blocking)!
      if (processingRef.current || !currentUser) return;

      let cooldownMs = 1500;
      try {
        processingRef.current = true;
        setProcessing(true);
        setScanError(null);

        const extractedQr = extractQrCodeId(decodedText);
        if (!extractedQr) {
          throw new Error('QR Code kosong / tidak terbaca.');
        }

        const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;

        if (!onlineNow) {
          cooldownMs = 1000;
          await recordOfflineLocally(extractedQr, currentUser);
          return;
        }

        try {
          const result = await attendanceService.recordAttendanceByQr({
            qr_code_id: extractedQr,
            recorded_by: currentUser.id,
            status: 'Hadir',
          });

          setLastScannedResult(result);

          if (result.alreadyRecorded) {
            message.warning({
              content: `${result.student?.full_name || 'Anggota'} sudah absen hadir hari ini!`,
              duration: 3,
            });
          } else {
            message.success({
              content: `Presensi berhasil: ${result.student?.full_name || 'Anggota'} (Hadir)`,
              duration: 3,
            });
          }

          setRecentScans((prev) => {
            const filtered = prev.filter((item) => item.student_id !== result.student_id);
            return [result, ...filtered].slice(0, 5);
          });
        } catch (onlineErr: unknown) {
          // Jika internet tiba-tiba putus saat request, otomatis alihkan ke antrean offline
          if (isLikelyNetworkError(onlineErr)) {
            setIsOnline(false);
            cooldownMs = 1000;
            await recordOfflineLocally(extractedQr, currentUser);
          } else {
            throw onlineErr;
          }
        }
      } catch (err: unknown) {
        setScanError(err instanceof Error ? err.message : 'Gagal memproses QR Code');
      } finally {
        setProcessing(false);
        setTimeout(() => {
          processingRef.current = false;
        }, cooldownMs);
      }
    },
    [currentUser, message, recordOfflineLocally]
  );

  // Buka Modal & Ambil Data Siswa + Status Absen Hari Ini
  const handleOpenManualModal = async () => {
    if (!isOnline) {
      message.warning('Absen massal per kelas memerlukan koneksi internet. Gunakan Scan QR untuk mode offline.');
      return;
    }

    setShowManualModal(true);
    try {
      setLoadingStudents(true);

      const [allStudents, todayRecords] = await Promise.all([
        attendanceService.getAllStudents(),
        attendanceService.getTodayAttendanceRecords(),
      ]);

      setStudents(allStudents);

      if (currentUser?.school_id) {
        void cacheStudentsForSchool(currentUser.school_id, allStudents).then((count) =>
          setCachedStudentCount(count)
        );
      }

      const map: { [id: string]: string } = {};
      (todayRecords as Array<{ student_id: string; status: string }>).forEach((rec) => {
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
      if (currentUser?.school_id) {
        const fallbackStudents = await getCachedStudents(currentUser.school_id);
        setStudents(fallbackStudents);
      }
      message.error('Gagal memuat daftar anggota.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const initDefaultAttendance = (
    allStudents: ScanStudentItem[],
    className: string,
    attendanceMap: { [id: string]: string }
  ) => {
    const filtered = allStudents.filter((s) => s.class_name === className);
    const initialMap: { [key: string]: ManualAttendanceStatus } = {};
    filtered.forEach((s) => {
      const existing = attendanceMap[s.id];
      initialMap[s.id] =
        existing === 'Hadir' ||
        existing === 'Izin' ||
        existing === 'Sakit' ||
        existing === 'Tidak Hadir'
          ? existing
          : 'Hadir';
    });
    setAttendanceState(initialMap);
  };

  const classOptions = useMemo(() => {
    const classes = students
      .map((s) => s.class_name)
      .filter((cls): cls is string => Boolean(cls));
    return Array.from(new Set(classes));
  }, [students]);

  const studentsInClass = useMemo(() => {
    return students.filter((s) => s.class_name === selectedClass);
  }, [students, selectedClass]);

  const handleClassChange = (className: string) => {
    setSelectedClass(className);
    initDefaultAttendance(students, className, todayAttendanceMap);
  };

  const handleStatusChange = (
    studentId: string,
    status: 'Hadir' | 'Izin' | 'Sakit' | 'Tidak Hadir'
  ) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmitBatch = async () => {
    if (!currentUser) return;

    try {
      setSubmittingBatch(true);
      const recordsToInsert = Object.keys(attendanceState).map((studentId) => ({
        student_id: studentId,
        recorded_by: currentUser.id,
        status: attendanceState[studentId],
      }));

      if (recordsToInsert.length === 0) {
        message.warning('Tidak ada data siswa untuk disimpan.');
        return;
      }

      await attendanceService.recordBatchAttendance(recordsToInsert);

      const history = await attendanceService.getRecentAttendance(20);
      const pendingItems = currentUser.school_id
        ? await getOfflineQueue(currentUser.school_id)
        : [];
      setRecentScans(mergeRecentWithPending(history, pendingItems));

      message.success(`Berhasil memperbarui presensi massal untuk Kelas ${selectedClass}!`);
      setShowManualModal(false);
    } catch (err: unknown) {
      console.error(err);
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan presensi massal.');
    } finally {
      setSubmittingBatch(false);
    }
  };

  if (loading) {
    return <PageLoader text="Menyiapkan Scanner Kamera..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <Header
          title="Scan QR Presensi Anggota"
          subtitle="Arahkan Kamera ke QR Code NTA / ID Anggota Penggalang"
        />

        {/* Bar Status Koneksi, Cache Offline & Auto-Sync */}
        <div
          className={`rounded-3xl p-4 sm:px-5 border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition ${
            !isOnline
              ? 'bg-amber-50 border-amber-200'
              : pendingCount > 0 || isSyncing
              ? 'bg-indigo-50 border-indigo-200'
              : 'bg-white border-slate-100'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                isOnline
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-200 text-amber-900'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-600 animate-pulse'
                }`}
              />
              {isOnline ? 'Online' : 'Offline'}
            </span>

            <span className="text-[11px] font-semibold text-slate-600">
              📦 {cachedStudentCount} siswa siap offline
            </span>

            {isSyncing ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-extrabold">
                🔄 Menyinkronkan {pendingCount} presensi... (tetap bisa scan)
              </span>
            ) : pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold">
                ⏳ {pendingCount} presensi menunggu sinkronisasi
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-700">
                ✓ Semua tersinkron
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOnline && currentUser?.school_id && (
              <button
                type="button"
                disabled={refreshingCache}
                onClick={() => void refreshStudentsCache(currentUser.school_id!, true)}
                className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                {refreshingCache ? 'Memperbarui...' : '↻ Refresh Cache'}
              </button>
            )}
            {pendingCount > 0 && isOnline && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void handleManualSync()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-xl transition shadow-sm cursor-pointer"
              >
                {isSyncing ? 'Menyinkronkan...' : '🔄 Sinkronkan Sekarang'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Kendala Kamera atau QR Code?
            </h2>
            <p className="text-xs text-slate-500">
              Gunakan absensi massal per kelas untuk koreksi titip absen / input manual
            </p>
          </div>

          <button
            onClick={handleOpenManualModal}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-3 rounded-2xl transition shadow-sm flex items-center gap-2 shrink-0 cursor-pointer"
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
                  <h3 className="font-bold text-base text-slate-900">
                    📋 Presensi Massal &amp; Koreksi Kehadiran
                  </h3>
                  <p className="text-xs text-slate-500">
                    Siswa yang sudah scan QR ditandai gradient warna lembut
                  </p>
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Pilih Kelas
                </label>
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
                            ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-emerald-300'
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
                          <div className="text-[10px] text-slate-500">
                            Regu: {student.group_name || '-'}
                          </div>
                        </div>

                        {/* Tombol Status */}
                        <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Hadir')}
                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition text-center ${
                              currentStatus === 'Hadir'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            Hadir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Izin')}
                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition text-center ${
                              currentStatus === 'Izin'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            Izin
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Sakit')}
                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition text-center ${
                              currentStatus === 'Sakit'
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            Sakit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Tidak Hadir')}
                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition text-center ${
                              currentStatus === 'Tidak Hadir'
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            Alpha
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
