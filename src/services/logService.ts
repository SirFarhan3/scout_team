import { supabase } from '@/lib/supabase';
import { LogEntry } from '@/types/log-harian';

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
  const { error } = await supabase
    .from('log_books')
    .upsert(
      { tanggal: dateStr, kegiatan: entries },
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
  // Cek dulu apakah tanggal sudah ada di database
  const { data: existing, error: checkError } = await supabase
    .from('log_books')
    .select('id')
    .eq('tanggal', dateStr)
    .maybeSingle();

  if (checkError) {
    throw new Error(checkError.message);
  }

  if (existing) {
    throw new Error(`Log harian untuk tanggal ${dateStr} sudah ada! Silakan gunakan fitur Edit pada tabel.`);
  }

  // Jika belum ada, lakukan insert baru
  const { error: insertError } = await supabase
    .from('log_books')
    .insert({ tanggal: dateStr, kegiatan: entries });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return true;
}