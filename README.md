# ⚜️ Scout Team Management Application (v1.0.0)

Aplikasi web manajemen dan administrasi kegiatan kepramukaan (Scout Team) modern yang dirancang untuk memudahkan pembina dan anggota dalam mengelola presensi kehadiran berbasis QR Code, database anggota, serta panduan materi latihan lengkap dengan rincian logistik (barang wajib & opsional).

---

## 📌 Versi Aplikasi & Rilis

- **Versi Saat Ini**: `v1.0.0` (Stable Production Ready)
- **Status Update Terakhir**: Implementasi Full CRUD Modul Materi, UI Filtering, dan Integrasi Supabase.

---

## 🚀 Fitur Utama

1. **Sistem Presensi & QR Code Scanner**
   - Presensi kehadiran anggota secara real-time menggunakan pemindaian kamera berbasis QR Code.
   - Dashboard statistik harian (Hadir, Izin/Sakit, dan Belum Absen).
2. **Manajemen Anggota (Siswa / Penggalang)**
   - Administrasi data anggota lengkap dengan filter berdasarkan nama, Nomor Tanda Anggota (NTA), kelas, dan regu penggalang.
3. **Database Materi & Logistik Latihan**
   - Panduan modul materi kepramukaan lengkap dengan deskripsi dan rincian alat/barang bawaan.
   - Dilengkapi indikator status perlengkapan: Mandatory (Wajib) vs Opsional (Tambahan).
   - Fitur pencarian (search) dan filter berdasarkan kategori materi.
4. **Manajemen Berbasis Role (Admin & Anggota)**
   - Akses penuh (CRUD) untuk Pembina/Admin dalam mengelola materi dan anggota.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS, TypeScript
- **Backend & Database**: Supabase (PostgreSQL & JSONB Data Type)
- **Authentication**: Custom Session & Role Management via Supabase/Local Auth

---

## ⚙️ Persyaratan Sistem & Instalasi

Pastikan komputer/laptop lu sudah menginstal:
- Node.js (Versi 18+ direkomendasikan)
- Package Manager (npm, yarn, atau pnpm)

### Langkah-langkah Instalasi:

1. **Clone repository ini (atau buka folder project di terminal):**
   ```bash
   cd d:/scout_team
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables:**
   Buat file `.env.local` di root folder project, lalu masukkan konfigurasi Supabase lu:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Jalankan server development lokal:**
   ```bash
   npm run dev
   ```

5. **Akses aplikasi di browser:**
   Buka http://localhost:3000.

---

## 📁 Struktur Folder Utama

```text
src/
├── app/                  # Next.js App Router (Halaman & Routing)
│   ├── materi/           # Modul Database Materi & Logistik
│   ├── scan/             # Modul Kamera QR Code Scanner Presensi
│   ├── anggota/          # Modul Manajemen Anggota Pramuka
│   └── page.tsx          # Dashboard Utama
├── components/           # Komponen UI Reusable (Header, dll)
├── services/             # API Service penghubung ke Supabase (materialService, dll)
├── types/                # Definisi Interface TypeScript (Material, Equipment, dll)
└── lib/                  # Konfigurasi Supabase & Auth Helper
```

---

## 📝 Lisensi
Project ini dikembangkan untuk kebutuhan operasional dan pelatihan kepramukaan secara mandiri.