# Panduan Setup Database Turso Cloud & Keamanan Produksi

## 1. Siapkan Variabel `.env.local`
Tambahkan atau pastikan variabel berikut ada di `.env.local` (atau environment variables di hosting Anda):

- `TURSO_DATABASE_URL`: URL database Turso (contoh: `libsql://nama-db-user.turso.io`). Untuk development lokal offline bisa memakai `file:./local.db`.
- `TURSO_AUTH_TOKEN`: Auth token database Turso dari `turso db tokens create <nama-db>` atau Dashboard Turso. *(Tidak diperlukan jika memakai `file:` lokal.)*
- `SESSION_SECRET`: String acak **minimal 32 karakter** untuk penandatanganan cookie sesi HttpOnly. Generate via:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `TELEGRAM_WEBHOOK_SECRET`: Secret acak untuk validasi header webhook Telegram (`x-telegram-bot-api-secret-token`).
- Variabel opsional sesuai fitur: `GEMINI_API_KEY`, `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_IDS`, `OMNI_BASE_URL`, `OMNI_API_KEY`.

## 2. Jalankan Migrasi Skema Turso
Jalankan perintah berikut dari root project untuk memasang seluruh 15 tabel, constraint `1 User = 1 Sekolah`, index performa, dan trigger isolasi lintas sekolah dari [`schema.sql`](file:///d:/scout_team_public/turso/schema.sql):

```bash
npm run db:migrate
```

*(Skrip menggunakan `CREATE TABLE IF NOT EXISTS` dan `CREATE TRIGGER IF NOT EXISTS`, sehingga aman dijalankan ulang.)*

## 3. Buat Akun Superadmin Pertama
Jalankan skrip seed berikut (ganti password dengan password kuat minimal 8 karakter kombinasi huruf & angka):

```bash
npm run db:seed-superadmin -- superadmin "GantiPasswordKuat123!" "Platform Superadmin"
```

Setelah itu login lewat `/login`, atau daftarkan sekolah baru langsung lewat `/register`.

## 4. Arsitektur Keamanan pada Turso
- **Zero Direct Browser DB Access**: Browser tidak pernah terhubung ke Turso secara langsung. Seluruh query berjalan di Next.js Route Handlers menggunakan [`turso.ts`](file:///d:/scout_team_public/src/lib/turso.ts) (`TURSO_AUTH_TOKEN` khusus server) dengan query SQL berparameter (`?`) yang kebal SQL injection.
- **1 User = 1 Sekolah**: Constraint `users_one_school_binding_check` memaksa setiap akun non-superadmin terikat ke tepat satu `school_id`. Seluruh trigger `BEFORE INSERT/UPDATE` dan `BEFORE DELETE` pada [`schema.sql`](file:///d:/scout_team_public/turso/schema.sql) mencegah relasi lintas sekolah dan memastikan penghapusan berantai bekerja konsisten di koneksi HTTP Turso.
- **Database-Backed HttpOnly Session**: Cookie sesi ditandatangani HMAC-SHA256 (`SESSION_SECRET`) dan diverifikasi terhadap tabel `user_sessions` serta `token_version` di Turso. Password di-hash menggunakan `bcryptjs` (cost 12).
- **Subscription Paywall**: Sekolah berstatus `pending`, `expired`, atau `suspended` (atau melewati `subscription_expires_at`) diblokir server (`402 Payment Required`) dan diarahkan ke `/billing`.
