'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { authService, UserSessionData } from '@/lib/auth';
import { attendanceService } from '@/services/attendanceService';
import { AttendanceRecord } from '@/types/attendance';
import RecentScansList from './components/RecentScansList';

// 🎯 Import NativeQrScanner tanpa SSR
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

      const history = await attendanceService.getRecentAttendance(5);
      setRecentScans(history);
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
        setRecentScans((prev) => [result, ...prev.slice(0, 4)]);
      } catch (err: any) {
        setScanError(err?.message || 'Gagal memproses QR Code');
      } finally {
        setTimeout(() => setProcessing(false), 2000);
      }
    },
    [processing, currentUser]
  );

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NativeQrScanner
            onScanSuccess={handleScanSuccess}
            processing={processing}
            scanError={scanError}
            lastScannedResult={lastScannedResult}
          />

          <RecentScansList recentScans={recentScans} />
        </div>

      </div>
    </div>
  );
}