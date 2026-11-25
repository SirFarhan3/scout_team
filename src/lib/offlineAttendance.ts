import type { UserSessionData } from '@/lib/auth';
import { getJwtToken } from '@/lib/apiClient';
import { extractQrCodeId } from '@/lib/sanitize';
import type { AttendanceStatus } from '@/types/attendance';

const DB_NAME = 'scoutfn_offline_db';
const DB_VERSION = 1;
const STORE_STUDENTS = 'students';
const STORE_QUEUE = 'queue';
const STORE_META = 'meta';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const OFFLINE_QUEUE_EVENT = 'scoutfn-offline-queue-changed';
export const OFFLINE_SYNC_STATUS_EVENT = 'scoutfn-offline-sync-status';

export interface CachedStudentRecord {
  id: string;
  school_id: string;
  full_name: string;
  class_name: string;
  group_name: string;
  qr_code_id: string;
}

export interface OfflineAttendanceQueueItem {
  client_id: string;
  school_id: string;
  student_id: string;
  qr_code_id: string;
  student_name: string;
  class_name: string;
  group_name: string;
  recorded_by: string;
  status: AttendanceStatus;
  scanned_at: string;
}

export interface SyncQueueResult {
  syncedCount: number;
  skippedCount: number;
  remainingCount: number;
  authRequired?: boolean;
  offline?: boolean;
  error?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let isSyncRunning = false;
let rerunRequested = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

export function getWibDateKey(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return wib.toISOString().slice(0, 10);
}

function generateClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function openOfflineDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB tidak tersedia di lingkungan ini.'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_STUDENTS)) {
        const studentStore = db.createObjectStore(STORE_STUDENTS, { keyPath: 'id' });
        studentStore.createIndex('by_school', 'school_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'client_id' });
        queueStore.createIndex('by_school', 'school_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Gagal membuka IndexedDB.'));
    };
  });

  return dbPromise;
}

function dispatchQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  }
}

function dispatchSyncStatus(detail: {
  syncing: boolean;
  lastResult?: SyncQueueResult;
}): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_STATUS_EVENT, { detail }));
  }
}

export function isOfflineSyncInProgress(): boolean {
  return isSyncRunning;
}

/**
 * Simpan profil user terakhir agar /scan tetap bisa dibuka saat offline.
 */
export async function cacheUserForOffline(user: UserSessionData): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({
        key: 'cached_user_profile',
        value: user,
        updated_at: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Abaikan jika gagal menulis cache meta
  }
}

export async function getCachedUserForOffline(): Promise<UserSessionData | null> {
  if (!isBrowser()) return null;
  try {
    const db = await openOfflineDb();
    return await new Promise<UserSessionData | null>((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('cached_user_profile');
      req.onsuccess = () => {
        const row = req.result as { value?: UserSessionData } | undefined;
        resolve(row?.value || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Simpan daftar siswa sekolah ke IndexedDB agar scan QR bisa memvalidasi siswa tanpa internet.
 */
export async function cacheStudentsForSchool(
  schoolId: string,
  rawStudents: Array<{
    id: string;
    full_name: string;
    class_name?: string | null;
    group_name?: string | null;
    team?: { name?: string | null } | null;
    qr_code_id?: string | null;
  }>
): Promise<number> {
  if (!isBrowser() || !schoolId) return 0;

  const db = await openOfflineDb();
  const normalized: CachedStudentRecord[] = rawStudents
    .filter((s) => s && s.id)
    .map((s) => ({
      id: String(s.id),
      school_id: schoolId,
      full_name: String(s.full_name || ''),
      class_name: String(s.class_name || ''),
      group_name: String(s.group_name || s.team?.name || '-'),
      qr_code_id: String(s.qr_code_id || ''),
    }));

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_STUDENTS, STORE_META], 'readwrite');
    const studentStore = tx.objectStore(STORE_STUDENTS);
    const metaStore = tx.objectStore(STORE_META);

    // Hapus data siswa lama milik sekolah ini terlebih dahulu agar sinkron
    const idx = studentStore.index('by_school');
    const cursorReq = idx.openCursor(IDBKeyRange.only(schoolId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        for (const student of normalized) {
          studentStore.put(student);
        }
        metaStore.put({
          key: `students_cached_at_${schoolId}`,
          value: new Date().toISOString(),
          count: normalized.length,
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return normalized.length;
}

export async function getStudentsCacheInfo(
  schoolId: string
): Promise<{ count: number; updatedAt: string | null }> {
  if (!isBrowser() || !schoolId) return { count: 0, updatedAt: null };
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(`students_cached_at_${schoolId}`);
      req.onsuccess = () => {
        const row = req.result as { count?: number; value?: string } | undefined;
        resolve({
          count: Number(row?.count) || 0,
          updatedAt: row?.value || null,
        });
      };
      req.onerror = () => resolve({ count: 0, updatedAt: null });
    });
  } catch {
    return { count: 0, updatedAt: null };
  }
}

export async function getCachedStudents(schoolId: string): Promise<CachedStudentRecord[]> {
  if (!isBrowser() || !schoolId) return [];
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_STUDENTS, 'readonly');
      const idx = tx.objectStore(STORE_STUDENTS).index('by_school');
      const req = idx.getAll(IDBKeyRange.only(schoolId));
      req.onsuccess = () => resolve((req.result as CachedStudentRecord[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function findCachedStudentByQr(
  schoolId: string,
  rawQr: string
): Promise<CachedStudentRecord | null> {
  const extracted = extractQrCodeId(rawQr).trim().toLowerCase();
  if (!extracted) return null;

  const students = await getCachedStudents(schoolId);
  return (
    students.find(
      (s) =>
        s.qr_code_id.trim().toLowerCase() === extracted ||
        s.id.trim().toLowerCase() === extracted
    ) || null
  );
}

/**
 * Ambil seluruh antrean presensi offline (baik pending maupun syncing).
 */
export async function getOfflineQueue(schoolId?: string): Promise<OfflineAttendanceQueueItem[]> {
  if (!isBrowser()) return [];
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_QUEUE);
      const req = schoolId
        ? store.index('by_school').getAll(IDBKeyRange.only(schoolId))
        : store.getAll();
      req.onsuccess = () => {
        const items = ((req.result as OfflineAttendanceQueueItem[]) || []).sort((a, b) =>
          a.scanned_at.localeCompare(b.scanned_at)
        );
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getOfflineQueueCount(schoolId?: string): Promise<number> {
  const items = await getOfflineQueue(schoolId);
  return items.length;
}

/**
 * Daftarkan Background Sync pada Service Worker (didukung di Chrome/Edge Android).
 */
async function registerBackgroundSyncTag(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;
    if (syncManager && typeof syncManager.register === 'function') {
      await syncManager.register('sync-attendance');
    }
  } catch {
    // Browser tidak mendukung Background Sync (mis. Safari iOS) — fallback pakai event online
  }
}

/**
 * Masukkan hasil scan QR ke antrean IndexedDB secara instan (non-blocking).
 */
export async function enqueueOfflineScan(params: {
  schoolId: string;
  student: CachedStudentRecord;
  recordedBy: string;
  status?: AttendanceStatus;
}): Promise<{ item: OfflineAttendanceQueueItem; duplicate: boolean }> {
  const nowIso = new Date().toISOString();
  const todayKey = getWibDateKey(nowIso);

  const existingQueue = await getOfflineQueue(params.schoolId);
  const existingToday = existingQueue.find(
    (q) => q.student_id === params.student.id && getWibDateKey(q.scanned_at) === todayKey
  );

  if (existingToday) {
    return { item: existingToday, duplicate: true };
  }

  const newItem: OfflineAttendanceQueueItem = {
    client_id: generateClientUuid(),
    school_id: params.schoolId,
    student_id: params.student.id,
    qr_code_id: params.student.qr_code_id,
    student_name: params.student.full_name,
    class_name: params.student.class_name,
    group_name: params.student.group_name,
    recorded_by: params.recordedBy,
    status: params.status || 'Hadir',
    scanned_at: nowIso,
  };

  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(newItem);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  dispatchQueueChanged();
  void registerBackgroundSyncTag();

  return { item: newItem, duplicate: false };
}

async function removeQueueItemsByIds(clientIds: string[]): Promise<void> {
  if (!isBrowser() || clientIds.length === 0) return;
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    for (const id of clientIds) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function ensureAuthHeaderForSync(): Promise<string | null> {
  const token = getJwtToken();
  if (token) return token;

  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.token === 'string' ? data.token : null;
  } catch {
    return null;
  }
}

/**
 * Menyinkronkan antrean presensi offline ke server secara non-blocking.
 * Scan baru yang masuk saat proses sync berjalan tetap aman (tidak terhapus)
 * dan otomatis disinkronkan pada batch berikutnya.
 */
export async function syncOfflineAttendanceQueue(
  schoolId?: string
): Promise<SyncQueueResult> {
  if (!isBrowser()) {
    return { syncedCount: 0, skippedCount: 0, remainingCount: 0 };
  }

  if (!navigator.onLine) {
    const remaining = await getOfflineQueueCount(schoolId);
    return { syncedCount: 0, skippedCount: 0, remainingCount: remaining, offline: true };
  }

  if (isSyncRunning) {
    rerunRequested = true;
    const remaining = await getOfflineQueueCount(schoolId);
    return { syncedCount: 0, skippedCount: 0, remainingCount: remaining };
  }

  const batch = (await getOfflineQueue(schoolId)).slice(0, 200);
  if (batch.length === 0) {
    return { syncedCount: 0, skippedCount: 0, remainingCount: 0 };
  }

  isSyncRunning = true;
  rerunRequested = false;
  dispatchSyncStatus({ syncing: true });

  let shouldRetryNextBatch = false;

  try {
    const token = await ensureAuthHeaderForSync();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/attendance/sync', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: JSON.stringify({
        items: batch.map((item) => ({
          client_id: item.client_id,
          student_id: item.student_id,
          qr_code_id: item.qr_code_id,
          status: item.status,
          scanned_at: item.scanned_at,
        })),
      }),
    });

    if (res.status === 401) {
      const remaining = await getOfflineQueueCount(schoolId);
      const result: SyncQueueResult = {
        syncedCount: 0,
        skippedCount: 0,
        remainingCount: remaining,
        authRequired: true,
        error: 'Sesi login berakhir. Silakan login kembali untuk menyinkronkan presensi offline.',
      };
      dispatchSyncStatus({ syncing: false, lastResult: result });
      return result;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || data?.message || `Gagal sinkronisasi (${res.status})`);
    }

    const confirmedIds: string[] = [
      ...(Array.isArray(data.syncedIds) ? data.syncedIds : []),
      ...(Array.isArray(data.skippedIds) ? data.skippedIds : []),
      ...(Array.isArray(data.rejectedIds) ? data.rejectedIds : []),
    ];

    // Hapus HANYA item yang dikonfirmasi server — scan baru yang masuk saat sync berlangsung tetap aman
    await removeQueueItemsByIds(confirmedIds);

    const remaining = await getOfflineQueueCount(schoolId);
    shouldRetryNextBatch = remaining > 0;
    const result: SyncQueueResult = {
      syncedCount: Number(data.syncedCount) || 0,
      skippedCount: Number(data.skippedCount) || 0,
      remainingCount: remaining,
    };

    dispatchQueueChanged();
    dispatchSyncStatus({ syncing: false, lastResult: result });
    return result;
  } catch (err: unknown) {
    const remaining = await getOfflineQueueCount(schoolId);
    const result: SyncQueueResult = {
      syncedCount: 0,
      skippedCount: 0,
      remainingCount: remaining,
      error: err instanceof Error ? err.message : 'Gagal menyinkronkan presensi offline.',
    };
    dispatchSyncStatus({ syncing: false, lastResult: result });
    return result;
  } finally {
    isSyncRunning = false;
    if ((rerunRequested || shouldRetryNextBatch) && typeof navigator !== 'undefined' && navigator.onLine) {
      rerunRequested = false;
      setTimeout(() => {
        void syncOfflineAttendanceQueue(schoolId);
      }, 400);
    }
  }
}
