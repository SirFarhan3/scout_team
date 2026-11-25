-- ============================================================================
-- SCOUT MANAGEMENT SAAS: TURSO / LIBSQL (SQLITE) SCHEMA
-- Multi-Tenant (1 User = 1 Sekolah), Paywall, Audit Log & Isolasi Ketat
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. TABEL MASTER SEKOLAH (TENANT & SUBSCRIPTION)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  npsn TEXT,
  city TEXT NOT NULL DEFAULT 'Indonesia',
  address TEXT,
  gugusdepan TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_plan IN ('trial', 'basic', 'pro', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('pending', 'trial', 'active', 'expired', 'suspended')),
  subscription_started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  subscription_expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+14 days')),
  max_students INTEGER NOT NULL DEFAULT 40 CHECK (max_students > 0),
  max_users INTEGER NOT NULL DEFAULT 5 CHECK (max_users > 0),
  ai_features_enabled INTEGER NOT NULL DEFAULT 1 CHECK (ai_features_enabled IN (0, 1)),
  ai_plan_credits INTEGER NOT NULL DEFAULT 2 CHECK (ai_plan_credits >= 0),
  ai_topup_credits INTEGER NOT NULL DEFAULT 0 CHECK (ai_topup_credits >= 0),
  telegram_chat_id INTEGER UNIQUE,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_schools_deleted_at ON schools (deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_name_lower_active
  ON schools (LOWER(TRIM(name)))
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. TABEL USERS (STRICT: 1 USER = 1 SEKOLAH; SUPERADMIN TANPA SEKOLAH)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'pembina'
    CHECK (role IN ('superadmin', 'admin', 'pembina', 'instruktur')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  token_version INTEGER NOT NULL DEFAULT 1,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT users_one_school_binding_check CHECK (
    (role = 'superadmin' AND school_id IS NULL)
    OR (role IN ('admin', 'pembina', 'instruktur') AND school_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users (school_id);

-- ----------------------------------------------------------------------------
-- 3. TABEL SESI SERVER (DATABASE-BACKED SESSIONS UNTUK REVOKASI INSTAN)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_version INTEGER NOT NULL DEFAULT 1,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);

-- ----------------------------------------------------------------------------
-- 4. TABEL BILLING: INVOICE & KODE LISENSI
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  invoice_number TEXT NOT NULL UNIQUE,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('basic', 'pro', 'enterprise')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount_idr INTEGER NOT NULL CHECK (amount_idr >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'manual_transfer'
    CHECK (payment_method IN ('manual_transfer', 'license_key', 'superadmin_grant', 'gateway')),
  payment_reference TEXT,
  payer_note TEXT,
  admin_note TEXT,
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_school_id
  ON subscription_invoices (school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS license_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  code_hash TEXT NOT NULL UNIQUE,
  code_preview TEXT NOT NULL,
  voucher_type TEXT NOT NULL DEFAULT 'plan' CHECK (voucher_type IN ('plan', 'ai_tokens', 'extend_days')),
  plan_code TEXT NOT NULL CHECK (plan_code IN ('basic', 'pro', 'enterprise')),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  ai_tokens INTEGER NOT NULL DEFAULT 0 CHECK (ai_tokens >= 0),
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  expires_at TEXT,
  redeemed_by_school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
  redeemed_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 5. TABEL SECURITY AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created
  ON security_audit_logs (school_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. TABEL DATA DOMAIN SEKOLAH (SEMUA WAJIB TERIKAT school_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'Campuran',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_school_name_lower
  ON teams (school_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_teams_school_id ON teams (school_id);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  class_name TEXT,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  nta TEXT,
  qr_code_id TEXT NOT NULL UNIQUE
    DEFAULT ('SCT-' || UPPER(SUBSTR(hex(randomblob(5)), 1, 10))),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_students_school_id ON students (school_id);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Hadir'
    CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Tanpa Keterangan', 'Tidak Hadir')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attendance_school_created
  ON attendance (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance (student_id);

CREATE TABLE IF NOT EXISTS team_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_team_scores_school_id ON team_scores (school_id);

CREATE TABLE IF NOT EXISTS student_bonus_points (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_student_bonus_school_id ON student_bonus_points (school_id);

CREATE TABLE IF NOT EXISTS point_presets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('team', 'student')),
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_point_presets_school_id ON point_presets (school_id);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_materials_school_created
  ON materials (school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS log_books (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  kegiatan TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_log_books_school_tanggal
  ON log_books (school_id, tanggal);

CREATE TABLE IF NOT EXISTS program_kerja (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  tahun_ajaran TEXT NOT NULL,
  golongan TEXT NOT NULL,
  nama_pangkalan TEXT NOT NULL,
  kegiatan TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_program_kerja_school_created
  ON program_kerja (school_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. TRIGGER INTEGRITAS LINTAS TABEL (CEGAH RELASI LINTAS SEKOLAH DI LEVEL DB)
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_students_same_school_team_ins
BEFORE INSERT ON students
WHEN NEW.team_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Regu bukan milik sekolah siswa ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE id = NEW.team_id AND school_id = NEW.school_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_students_same_school_team_upd
BEFORE UPDATE ON students
WHEN NEW.team_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Regu bukan milik sekolah siswa ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE id = NEW.team_id AND school_id = NEW.school_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_attendance_same_school_ins
BEFORE INSERT ON attendance
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Siswa bukan milik sekolah presensi ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM students WHERE id = NEW.student_id AND school_id = NEW.school_id
  );
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Pencatat presensi bukan dari sekolah yang sama.')
  WHERE NEW.recorded_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM users WHERE id = NEW.recorded_by AND school_id = NEW.school_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_attendance_same_school_upd
BEFORE UPDATE ON attendance
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Siswa bukan milik sekolah presensi ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM students WHERE id = NEW.student_id AND school_id = NEW.school_id
  );
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Pencatat presensi bukan dari sekolah yang sama.')
  WHERE NEW.recorded_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM users WHERE id = NEW.recorded_by AND school_id = NEW.school_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_team_scores_same_school_ins
BEFORE INSERT ON team_scores
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Regu bukan milik sekolah ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE id = NEW.team_id AND school_id = NEW.school_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_team_scores_same_school_upd
BEFORE UPDATE ON team_scores
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Regu bukan milik sekolah ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE id = NEW.team_id AND school_id = NEW.school_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_student_bonus_same_school_ins
BEFORE INSERT ON student_bonus_points
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Siswa bukan milik sekolah ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM students WHERE id = NEW.student_id AND school_id = NEW.school_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_student_bonus_same_school_upd
BEFORE UPDATE ON student_bonus_points
BEGIN
  SELECT RAISE(ABORT, 'Pelanggaran isolasi sekolah: Siswa bukan milik sekolah ini.')
  WHERE NOT EXISTS (
    SELECT 1 FROM students WHERE id = NEW.student_id AND school_id = NEW.school_id
  );
END;

-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 7B. TABEL LOG KUOTA & TOKEN AI (HYBRID: PLAN CREDITS + TOP-UP CREDITS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_credit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('usage', 'plan_reset', 'topup', 'refund')),
  source TEXT NOT NULL CHECK (source IN ('plan', 'topup')),
  amount INTEGER NOT NULL,
  feature TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_logs_school_id
  ON ai_credit_logs (school_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7C. TABEL INVOICES TERPADU (TAGIHAN PENDING & KWITANSI LUNAS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  invoice_number TEXT NOT NULL UNIQUE,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  gugusdepan TEXT,
  contact_name TEXT,
  contact_email TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('subscription', 'topup')),
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  period_start TEXT,
  period_end TEXT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'Transfer Bank / QRIS',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_school_id
  ON invoices (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices (status, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7D. TABEL RIWAYAT LIVE CHAT AI (ASISTEN PEMBINA PRAMUKA PER SEKOLAH)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_school_created
  ON ai_chat_messages (school_id, created_at);

-- 8. TRIGGER CASCADE & CLEANUP (AMAN DI TURSO HTTP STATELESS CONNECTION)
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_schools_cleanup_del
BEFORE DELETE ON schools
BEGIN
  DELETE FROM ai_chat_messages WHERE school_id = OLD.id;
  DELETE FROM invoices WHERE school_id = OLD.id;
  DELETE FROM ai_credit_logs WHERE school_id = OLD.id;
  DELETE FROM user_sessions WHERE school_id = OLD.id;
  DELETE FROM subscription_invoices WHERE school_id = OLD.id;
  DELETE FROM security_audit_logs WHERE school_id = OLD.id;
  UPDATE license_keys SET redeemed_by_school_id = NULL WHERE redeemed_by_school_id = OLD.id;
  DELETE FROM attendance WHERE school_id = OLD.id;
  DELETE FROM student_bonus_points WHERE school_id = OLD.id;
  DELETE FROM team_scores WHERE school_id = OLD.id;
  DELETE FROM students WHERE school_id = OLD.id;
  DELETE FROM teams WHERE school_id = OLD.id;
  DELETE FROM point_presets WHERE school_id = OLD.id;
  DELETE FROM materials WHERE school_id = OLD.id;
  DELETE FROM log_books WHERE school_id = OLD.id;
  DELETE FROM program_kerja WHERE school_id = OLD.id;
  DELETE FROM users WHERE school_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_teams_cleanup_del
BEFORE DELETE ON teams
BEGIN
  UPDATE students SET team_id = NULL WHERE team_id = OLD.id;
  DELETE FROM team_scores WHERE team_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_students_cleanup_del
BEFORE DELETE ON students
BEGIN
  DELETE FROM attendance WHERE student_id = OLD.id;
  DELETE FROM student_bonus_points WHERE student_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_cleanup_del
BEFORE DELETE ON users
BEGIN
  DELETE FROM user_sessions WHERE user_id = OLD.id;
  UPDATE attendance SET recorded_by = NULL WHERE recorded_by = OLD.id;
  UPDATE subscription_invoices SET requested_by = NULL WHERE requested_by = OLD.id;
  UPDATE subscription_invoices SET verified_by = NULL WHERE verified_by = OLD.id;
  UPDATE license_keys SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE security_audit_logs SET user_id = NULL WHERE user_id = OLD.id;
  UPDATE ai_chat_messages SET user_id = NULL WHERE user_id = OLD.id;
END;

