import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url) {
    console.error('❌ TURSO_DATABASE_URL belum diatur di .env.local atau environment.');
    process.exit(1);
  }
  if (!url.startsWith('file:') && !authToken) {
    console.error('❌ TURSO_AUTH_TOKEN wajib diatur untuk database Turso remote.');
    process.exit(1);
  }

  const schemaPath = path.resolve(process.cwd(), 'turso/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  try {
    console.log(`Menjalankan migrasi skema Turso ke ${url.startsWith('file:') ? url : 'Turso Cloud'}...`);
    await client.executeMultiple(schemaSql);
    try {
      await client.execute('ALTER TABLE schools ADD COLUMN deleted_at TEXT');
    } catch {
      // Kolom deleted_at sudah ada
    }
    await client.execute('CREATE INDEX IF NOT EXISTS idx_schools_deleted_at ON schools (deleted_at)');
    try {
      await client.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_name_lower_active ON schools (LOWER(TRIM(name))) WHERE deleted_at IS NULL'
      );
    } catch {
      // Abaikan jika di DB lama masih ada nama duplikat sebelum dibersihkan
    }
    const tables = await client.execute(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'trigger') ORDER BY type, name"
    );
    const tableCount = tables.rows.filter((r) => r.type === 'table').length;
    const triggerCount = tables.rows.filter((r) => r.type === 'trigger').length;
    console.log(`✅ Migrasi selesai! (${tableCount} tabel, ${triggerCount} trigger terpasang)`);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('❌ Gagal menjalankan migrasi Turso:', err);
  process.exit(1);
});
