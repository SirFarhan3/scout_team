/**
 * Utilitas keamanan input & sanitasi (Client & Server) untuk mencegah:
 * - Injeksi tag HTML (<script>, <img>, <svg>, <iframe>, dll.)
 * - Eksekusi JavaScript URI (javascript:, data:text/html, vbscript:)
 * - Inline Event Handlers (onload=, onerror=, onclick=, dll.)
 * - Instruksi eksekusi kode berbahaya (eval, document.cookie, localStorage, dll.)
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Pola berbahaya yang dilarang masuk ke dalam form input aplikasi.
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  // Tag HTML apa pun seperti <script>, <img>, <svg>, <iframe>, <a ...>, </tag>
  /<\s*\/?\s*[a-zA-Z!][a-zA-Z0-9:-]*(\s+[^>]*)?>/i,
  // Kurung siku pembuka tag HTML tidak lengkap seperti <script atau <img
  /<\s*(script|iframe|object|embed|svg|img|style|link|meta|body|form|input|button|math|video|audio)\b/i,
  // Protokol eksekusi skrip
  /\b(javascript|vbscript|livescript)\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  // Inline DOM event handlers (onerror=, onload=, onclick=, onmouseover=, dll.)
  /\bon[a-z]{3,20}\s*=/i,
  // Pemanggilan fungsi eksekusi kode JS / akses DOM sensitif
  /\b(eval|Function|setTimeout|setInterval)\s*\(/i,
  /\b(document\s*\.\s*(cookie|write|writeln|domain)|window\s*\.\s*location|localStorage|sessionStorage)\b/i,
  // Template / expression injection
  /\$\{\s*[^}]+\s*\}/,
];

/**
 * Mengecek apakah teks mengandung indikasi kode HTML, JavaScript, atau payload XSS.
 */
export function containsDangerousCode(input: unknown): boolean {
  if (typeof input !== 'string' || !input) return false;
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Memvalidasi input teks dari pengguna:
 * - Menolak input (throw Error) jika terdeteksi tag HTML, atribut event JS, atau kode skrip.
 * - Menghapus karakter kontrol tersembunyi.
 * - Membatasi panjang karakter maksimal.
 */
export function assertSafeText(
  input: unknown,
  fieldLabel = 'Input',
  maxLength = 500
): string {
  if (input === null || input === undefined) return '';
  const text = String(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();

  if (containsDangerousCode(text)) {
    throw new Error(
      `${fieldLabel} ditolak: Tidak boleh mengandung tag HTML, kode JavaScript, atau instruksi skrip!`
    );
  }

  if (text.length > maxLength) {
    throw new Error(
      `${fieldLabel} terlalu panjang (maksimal ${maxLength} karakter).`
    );
  }

  return text;
}

/**
 * Membersihkan teks panjang (seperti deskripsi materi) dengan membuang tag HTML/skrip berbahaya
 * sekaligus melempar error jika ditemukan payload injeksi aktif.
 */
export function assertSafeLongText(
  input: unknown,
  fieldLabel = 'Deskripsi',
  maxLength = 15000
): string {
  if (input === null || input === undefined) return '';
  const text = String(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();

  if (containsDangerousCode(text)) {
    throw new Error(
      `${fieldLabel} ditolak: Tidak boleh mengandung tag HTML (<...>) atau kode JavaScript!`
    );
  }

  if (text.length > maxLength) {
    throw new Error(
      `${fieldLabel} terlalu panjang (maksimal ${maxLength} karakter).`
    );
  }

  return text;
}

/**
 * Validasi khusus username (hanya huruf, angka, titik, garis bawah, atau strip).
 */
export function assertSafeUsername(input: unknown): string {
  const clean = assertSafeText(input, 'Username', 50);
  if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
    throw new Error(
      'Username hanya boleh berisi huruf, angka, titik (.), garis bawah (_), atau strip (-).'
    );
  }
  return clean;
}

/**
 * Validasi bahwa Data URL hanya berupa gambar PNG base64 yang sah sebelum disisipkan ke <img>.
 */
export function isSafePngDataUrl(url: string): boolean {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url);
}

export const ALLOWED_ROLES = ['admin', 'pembina', 'instruktur'] as const;
export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export function isAllowedRole(role: unknown): role is AllowedRole {
  return typeof role === 'string' && (ALLOWED_ROLES as readonly string[]).includes(role);
}
