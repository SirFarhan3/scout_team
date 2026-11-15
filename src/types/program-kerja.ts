export interface ProkerEntry {
  id?: string;
  pekan_ke: string;
  durasi: string;
  kegiatan: string;
  keterangan_kegiatan: string;
}

export interface ProkerItem {
  id: string;
  tahun_ajaran: string;
  golongan: string;
  nama_pangkalan: string;
  kegiatan: ProkerEntry[];
  created_at?: string;
}

export interface ActivityItem extends ProkerEntry {
  id?: string;
}