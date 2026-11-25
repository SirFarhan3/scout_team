import 'server-only';
import { createClient, type Client, type InArgs, type ResultSet, type Row } from '@libsql/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { AllowedRole } from '@/lib/sanitize';

let cachedClient: Client | null = null;
let fkPragmaReady: Promise<void> | null = null;

/**
 * Mengembalikan singleton client Turso / libSQL (@libsql/client).
 * Wajib dipanggil HANYA di sisi server (Route Handler / Server Helper).
 */
export function getTursoClient(): Client {
  if (cachedClient) return cachedClient;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url) {
    throw new Error('Konfigurasi server tidak lengkap: TURSO_DATABASE_URL belum diatur.');
  }

  const isLocalFile = url.startsWith('file:');
  if (!isLocalFile && !authToken) {
    throw new Error(
      'Konfigurasi server tidak lengkap: TURSO_AUTH_TOKEN belum diatur di environment server.'
    );
  }

  cachedClient = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  return cachedClient;
}

export async function getDb(): Promise<Client> {
  const client = getTursoClient();
  if (!fkPragmaReady) {
    fkPragmaReady = (async () => {
      try {
        await client.execute('PRAGMA foreign_keys = ON');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[TURSO] Gagal set PRAGMA foreign_keys = ON:', msg);
      }
      try {
        await client.execute('ALTER TABLE schools ADD COLUMN deleted_at TEXT');
      } catch {
        // Kolom deleted_at sudah ada
      }
      try {
        await client.execute(
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_name_lower_active ON schools (LOWER(TRIM(name))) WHERE deleted_at IS NULL'
        );
      } catch {
        // Index sudah ada atau masih ada data duplikat lama
      }
      try {
        await client.execute('UPDATE schools SET max_users = 5 WHERE max_users < 5');
      } catch {
        // Abaikan bila gagal
      }
      try {
        await client.execute(
          'ALTER TABLE schools ADD COLUMN ai_plan_credits INTEGER NOT NULL DEFAULT 2 CHECK (ai_plan_credits >= 0)'
        );
      } catch {
        // Kolom ai_plan_credits sudah ada
      }
      try {
        await client.execute(
          'ALTER TABLE schools ADD COLUMN ai_topup_credits INTEGER NOT NULL DEFAULT 0 CHECK (ai_topup_credits >= 0)'
        );
      } catch {
        // Kolom ai_topup_credits sudah ada
      }
      try {
        await client.execute(`
          CREATE TABLE IF NOT EXISTS ai_credit_logs (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
            school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            type TEXT NOT NULL CHECK (type IN ('usage', 'plan_reset', 'topup', 'refund')),
            source TEXT NOT NULL CHECK (source IN ('plan', 'topup')),
            amount INTEGER NOT NULL,
            feature TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          )
        `);
        await client.execute(
          'CREATE INDEX IF NOT EXISTS idx_ai_credit_logs_school_id ON ai_credit_logs (school_id, created_at DESC)'
        );
      } catch {
        // Tabel ai_credit_logs sudah ada
      }
      try {
        await client.execute(`
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
          )
        `);
        await client.execute(
          'CREATE INDEX IF NOT EXISTS idx_invoices_school_id ON invoices (school_id, created_at DESC)'
        );
        await client.execute(
          'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status, created_at DESC)'
        );
      } catch {
        // Tabel invoices sudah ada
      }
      try {
        await client.execute(
          "ALTER TABLE license_keys ADD COLUMN voucher_type TEXT NOT NULL DEFAULT 'plan'"
        );
      } catch {
        // Kolom voucher_type sudah ada
      }
      try {
        await client.execute(
          'ALTER TABLE license_keys ADD COLUMN ai_tokens INTEGER NOT NULL DEFAULT 0'
        );
      } catch {
        // Kolom ai_tokens sudah ada
      }
      try {
        await client.execute('ALTER TABLE attendance ADD COLUMN synced_at TEXT');
      } catch {
        // Kolom synced_at sudah ada
      }
      try {
        await client.execute(`
          CREATE TABLE IF NOT EXISTS ai_chat_messages (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
            school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            user_name TEXT,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          )
        `);
        await client.execute(
          'CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_school_created ON ai_chat_messages (school_id, created_at)'
        );
      } catch {
        // Tabel ai_chat_messages sudah ada
      }
    })();
  }
  await fkPragmaReady;
  return client;
}

export async function dbAll<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T[]> {
  const db = await getDb();
  const res = await db.execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function dbOne<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T | null> {
  const rows = await dbAll<T>(sql, args);
  return rows.length > 0 ? rows[0] : null;
}

export async function dbExec(sql: string, args: InArgs = []): Promise<ResultSet> {
  const db = await getDb();
  return db.execute({ sql, args });
}

export function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return Boolean(value);
}

export function toSqlBool(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return fallback;
}

export function escapeSqlLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

export function firstRow<T = Row>(res: ResultSet): T | null {
  return res.rows && res.rows.length > 0 ? (res.rows[0] as unknown as T) : null;
}

export async function hashPassword(rawPassword: string): Promise<string> {
  return bcrypt.hash(rawPassword, 12);
}

export async function verifyPassword(rawPassword: string, storedHash: string): Promise<boolean> {
  if (!rawPassword || !storedHash) return false;
  return bcrypt.compare(rawPassword, storedHash);
}

export async function createNewUser(params: {
  username: string;
  fullName: string;
  password: string;
  role: AllowedRole;
  schoolId: string | null;
}): Promise<{
  id: string;
  username: string;
  full_name: string;
  role: AllowedRole;
  school_id: string | null;
  is_active: boolean;
  created_at: string;
}> {
  const { role, schoolId } = params;
  if (!['superadmin', 'admin', 'pembina', 'instruktur'].includes(role)) {
    throw new Error('Role tidak valid.');
  }
  if (role === 'superadmin' && schoolId !== null) {
    throw new Error('Superadmin tidak boleh terikat pada sekolah.');
  }
  if (role !== 'superadmin' && !schoolId) {
    throw new Error('User non-superadmin wajib terikat ke satu sekolah.');
  }

  const id = crypto.randomUUID();
  const cleanUsername = params.username.trim().toLowerCase();
  const cleanFullName = params.fullName.trim();
  const passwordHash = await hashPassword(params.password);
  const nowIso = new Date().toISOString();

  const row = await dbOne<Record<string, unknown>>(
    `INSERT INTO users (id, school_id, username, full_name, password_hash, role, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     RETURNING id, username, full_name, role, school_id, is_active, created_at`,
    [id, schoolId, cleanUsername, cleanFullName, passwordHash, role, nowIso]
  );

  if (!row) {
    throw new Error('Gagal membuat akun pengguna baru.');
  }

  return {
    id: String(row.id),
    username: String(row.username),
    full_name: String(row.full_name),
    role: row.role as AllowedRole,
    school_id: row.school_id ? String(row.school_id) : null,
    is_active: toBool(row.is_active),
    created_at: String(row.created_at),
  };
}

const DEFAULT_POINT_PRESETS: ReadonlyArray<{
  title: string;
  target_type: 'team' | 'student';
  points: number;
}> = [
  { title: 'Juara 1 Minigame / Lomba Pramuka', target_type: 'team', points: 25 },
  { title: 'Juara 2 Minigame / Lomba Pramuka', target_type: 'team', points: 15 },
  { title: 'Juara 3 Minigame / Lomba Pramuka', target_type: 'team', points: 10 },
  { title: 'Yel-Yel & Kekompakan Terbaik', target_type: 'team', points: 15 },
  { title: 'Pionering / Tenda Tercepat & Rapi', target_type: 'team', points: 20 },
  { title: 'Kuis Sandi Morse & Semaphore', target_type: 'team', points: 15 },
  { title: 'Pengurangan Kedisiplinan / Kurang Kompak', target_type: 'team', points: -10 },
  { title: 'Pelanggaran Aturan Kegiatan Regu', target_type: 'team', points: -15 },
  { title: 'Aktif Menjawab Pertanyaan Pembina', target_type: 'student', points: 5 },
  { title: 'Pemenang Kuis / Minigame Individu', target_type: 'student', points: 10 },
  { title: 'Lulus Uji Poin SKU / SKK', target_type: 'student', points: 10 },
  { title: 'Atribut Pramuka Lengkap & Rapi', target_type: 'student', points: 5 },
  { title: 'Memimpin Barisan / Membantu Kegiatan', target_type: 'student', points: 5 },
  { title: 'Atribut Tidak Lengkap / Kurang Rapi', target_type: 'student', points: -5 },
  { title: 'Terlambat Apel / Kurang Tertib', target_type: 'student', points: -10 },
];

export async function seedDefaultPointPresets(schoolId: string): Promise<void> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  await db.batch(
    DEFAULT_POINT_PRESETS.map((preset) => ({
      sql: `INSERT INTO point_presets (id, school_id, title, target_type, points, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), schoolId, preset.title, preset.target_type, preset.points, nowIso],
    })),
    'write'
  );
}
