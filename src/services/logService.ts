import { supabase } from '@/lib/supabase';
import { LogEntry } from '@/types/log-harian';
import { assertSafeText } from '@/lib/sanitize';

function sanitizeLogEntries(entries: LogEntry[]): LogEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((item, idx) => ({
    ...item,
    waktu: assertSafeText(item.waktu, `Waktu baris #${idx + 1}`, 60),
    kegiatan: assertSafeText(item.kegiatan, `Kegiatan baris #${idx + 1}`, 1000),
  }));
}

export async function getAllLogs() {
  const { data, error } = await supabase
    .from('log_books')
    .select('*')
    .order('tanggal', { ascending: false });

  if (error) {
    console.error('Error fetching logs:', error.message);
    return [];
  }
  return data || [];
}

// Upsert log (1 row per 1 hari)
export async function upsertLog(dateStr: string, entries: LogEntry[]) {
  const safeDate = assertSafeText(dateStr, 'Tanggal Log', 30);
  const safeEntries = sanitizeLogEntries(entries);

  const { error } = await supabase
    .from('log_books')
    .upsert(
      { tanggal: safeDate, kegiatan: safeEntries },
      { onConflict: 'tanggal' }
    );

  if (error) throw new Error(error.message);
  return true;
}

// Hapus log berdasarkan ID atau Tanggal
export async function deleteLog(id: string) {
  const { error } = await supabase
    .from('log_books')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

export async function createLog(dateStr: string, entries: LogEntry[]) {
  const safeDate = assertSafeText(dateStr, 'Tanggal Log', 30);
  const safeEntries = sanitizeLogEntries(entries);

  // Cek dulu apakah tanggal sudah ada di database
  const { data: existing, error: checkError } = await supabase
    .from('log_books')
    .select('id')
    .eq('tanggal', safeDate)
    .maybeSingle();

  if (checkError) {
    throw new Error(checkError.message);
  }

  if (existing) {
    throw new Error(`Log harian untuk tanggal ${safeDate} sudah ada! Silakan gunakan fitur Edit pada tabel.`);
  }

  // Jika belum ada, lakukan insert baru
  const { error: insertError } = await supabase
    .from('log_books')
    .insert({ tanggal: safeDate, kegiatan: safeEntries });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return true;
}