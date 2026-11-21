import { apiFetch } from '@/lib/apiClient';
import { LogEntry } from '@/types/log-harian';

export async function getAllLogs() {
  const res = await apiFetch<{ success: true; logs: any[] }>('/api/logs');
  return res.logs || [];
}

export async function upsertLog(dateStr: string, entries: LogEntry[]) {
  await apiFetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify({ mode: 'upsert', tanggal: dateStr, entries }),
  });
  return true;
}

export async function deleteLog(id: string) {
  await apiFetch(`/api/logs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return true;
}

export async function createLog(dateStr: string, entries: LogEntry[]) {
  await apiFetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify({ mode: 'create', tanggal: dateStr, entries }),
  });
  return true;
}
