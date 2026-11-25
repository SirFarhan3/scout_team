'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  OFFLINE_QUEUE_EVENT,
  OFFLINE_SYNC_STATUS_EVENT,
  getOfflineQueueCount,
  isOfflineSyncInProgress,
  syncOfflineAttendanceQueue,
  type SyncQueueResult,
} from '@/lib/offlineAttendance';

export default function OfflineSyncManager() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const refreshCount = useCallback(async () => {
    const count = await getOfflineQueueCount();
    setPendingCount(count);
    setIsSyncing(isOfflineSyncInProgress());
  }, []);

  const triggerSync = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.onLine) return;
    const count = await getOfflineQueueCount();
    if (count === 0) return;
    await syncOfflineAttendanceQueue();
    await refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Daftarkan Service Worker PWA agar /scan bisa dibuka saat offline
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Abaikan jika browser membatasi Service Worker (mis. mode private)
      });
    }

    const handleOnline = () => {
      setIsOnline(true);
      void triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void triggerSync();
      }
    };
    const handleQueueChanged = () => {
      void refreshCount();
    };
    const handleSyncStatus = (event: Event) => {
      const custom = event as CustomEvent<{ syncing: boolean; lastResult?: SyncQueueResult }>;
      setIsSyncing(Boolean(custom.detail?.syncing));
      void refreshCount();
    };
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TRIGGER_ATTENDANCE_SYNC') {
        void triggerSync();
      }
    };

    // Sinkronisasi awal saat halaman dimuat
    const initTimer = setTimeout(() => {
      setIsOnline(navigator.onLine);
      void refreshCount();
      if (navigator.onLine) {
        void triggerSync();
      }
    }, 600);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
    window.addEventListener(OFFLINE_SYNC_STATUS_EVENT, handleSyncStatus);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
      window.removeEventListener(OFFLINE_SYNC_STATUS_EVENT, handleSyncStatus);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [refreshCount, triggerSync]);

  // Di halaman /scan sudah ada banner status lengkap; tampilkan pill ringkas hanya di halaman lain jika ada antrean
  if (pathname.startsWith('/scan') || (pendingCount === 0 && !isSyncing)) {
    return null;
  }

  return (
    <div className="print:hidden fixed bottom-20 left-4 md:bottom-6 md:left-6 z-40">
      <div className="flex items-center gap-2 bg-white border border-amber-300 shadow-lg rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800">
        <span>{isSyncing ? '🔄' : isOnline ? '⏳' : '🟠'}</span>
        <span>
          {isSyncing
            ? `Menyinkronkan ${pendingCount} presensi...`
            : isOnline
            ? `${pendingCount} presensi offline belum sync`
            : `Offline • ${pendingCount} presensi tersimpan lokal`}
        </span>
        {isOnline && !isSyncing && (
          <button
            type="button"
            onClick={() => void triggerSync()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-xl transition cursor-pointer"
          >
            Sync
          </button>
        )}
      </div>
    </div>
  );
}
