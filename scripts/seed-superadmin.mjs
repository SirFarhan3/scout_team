import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
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
    console.error('❌ TURSO_DATABASE_URL belum diatur.');
    process.exit(1);
  }
  if (!url.startsWith('file:') && !authToken) {
    console.error('❌ TURSO_AUTH_TOKEN belum diatur.');
    process.exit(1);
  }

  const username = (process.argv[2] || process.env.SUPERADMIN_USERNAME || 'superadmin')
    .trim()
    .toLowerCase();
  const password = process.argv[3] || process.env.SUPERADMIN_PASSWORD || '';
  const fullName = (process.argv[4] || process.env.SUPERADMIN_NAME || 'Platform Superadmin').trim();

  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    console.error('❌ Username harus 3-50 karakter (huruf kecil, angka, titik, underscore, atau strip).');
    process.exit(1);
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    console.error(
      '❌ Password wajib minimal 8 karakter dengan kombinasi huruf dan angka.\nContoh: node scripts/seed-superadmin.mjs superadmin "PasswordKuat123!" "Platform Superadmin"'
    );
    process.exit(1);
  }

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  try {
    await client.execute('PRAGMA foreign_keys = ON');
    const existing = await client.execute({
      sql: 'SELECT id, role FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      args: [username],
    });
    if (existing.rows.length > 0) {
      console.error(`❌ Username "${username}" sudah terdaftar (role: ${existing.rows[0].role}).`);
      process.exit(1);
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const createdAt = new Date().toISOString();

    await client.execute({
      sql: `INSERT INTO users (id, school_id, username, full_name, password_hash, role, is_active, created_at)
            VALUES (?, NULL, ?, ?, ?, 'superadmin', 1, ?)`,
      args: [id, username, fullName, passwordHash, createdAt],
    });

    console.log(`✅ Akun Superadmin berhasil dibuat: username="${username}", id=${id}`);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('❌ Gagal membuat akun Superadmin:', err);
  process.exit(1);
});
