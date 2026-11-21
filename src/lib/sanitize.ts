/**
 * Utilitas keamanan input & sanitasi (Client & Server) untuk mencegah:
 * - Injeksi tag HTML (<script>, <img>, <svg>, <iframe>, dll.)
 * - Eksekusi JavaScript URI (javascript:, data:text/html, vbscript:)
 * - Inline Event Handlers (onload=, onerror=, onclick=, dll.)
 * - Instruksi eksekusi kode berbahaya (eval, document.cookie, localStorage, dll.)
 * - Formula Injection pada ekspor Excel/CSV
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

const DANGEROUS_PATTERNS: RegExp[] = [
  /<\s*\/?\s*[a-zA-Z!][a-zA-Z0-9:-]*(\s+[^>]*)?>/i,
  /<\s*(script|iframe|object|embed|svg|img|style|link|meta|body|form|input|button|math|video|audio)\b/i,
  /\b(javascript|vbscript|livescript)\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  /\bon[a-z]{3,20}\s*=/i,
  /\b(eval|Function|setTimeout|setInterval)\s*\(/i,
  /\b(document\s*\.\s*(cookie|write|writeln|domain)|window\s*\.\s*location|localStorage|sessionStorage)\b/i,
  /\$\{\s*[^}]+\s*\}/,
];

export function containsDangerousCode(input: unknown): boolean {
  if (typeof input !== 'string' || !input) return false;
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

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
 * Mengekstrak kode unik (misalnya "gvSddhZs7a") dari URL kartu KTA AyoPramuka Kwarnas
 * seperti "https://ayopramuka-kwarnas.id/kepramukaan/gvSddhZs7a" atau mengembalikan teks aslinya.
 */
export function extractQrCodeId(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (trimmed.includes('/')) {
    try {
      const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const parsed = new URL(normalizedUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return segments[segments.length - 1].trim();
      }
    } catch {
      const parts = trimmed.split(/[/?#]/).filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1].trim();
      }
    }
  }

  return trimmed;
}

export function assertSafeUsername(input: unknown): string {
  const raw = typeof input === 'string' && input.includes('/') ? extractQrCodeId(input) : input;
  const clean = assertSafeText(raw, 'Username', 50);
  if (clean.length < 3) {
    throw new Error('Username minimal 3 karakter.');
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
    throw new Error(
      'Username hanya boleh berisi huruf, angka, titik (.), garis bawah (_), atau strip (-).'
    );
  }
  return clean;
}

export function assertStrongPassword(input: unknown, fieldLabel = 'Password'): string {
  if (typeof input !== 'string') {
    throw new Error(`${fieldLabel} wajib diisi.`);
  }
  const pass = input.trim();
  if (pass.length < 8) {
    throw new Error(`${fieldLabel} minimal 8 karakter.`);
  }
  if (pass.length > 128) {
    throw new Error(`${fieldLabel} maksimal 128 karakter.`);
  }
  if (!/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) {
    throw new Error(`${fieldLabel} wajib mengandung kombinasi huruf dan angka.`);
  }
  return pass;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertValidUuid(value: unknown, fieldLabel = 'ID'): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value.trim())) {
    throw new Error(`${fieldLabel} tidak valid.`);
  }
  return value.trim();
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function isSafePngDataUrl(url: string): boolean {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url);
}

/**
 * Cegah Excel/CSV Formula Injection (DDE/CSV Injection) untuk string yang diawali =, +, -, @, tab, CR.
 */
export function sanitizeSpreadsheetCell(value: unknown): string | number {
  if (typeof value === 'number') return value;
  const str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function slugifySchoolName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'sekolah';
}

export const SCHOOL_ROLES = ['admin', 'pembina', 'instruktur'] as const;
export type SchoolRole = (typeof SCHOOL_ROLES)[number];

export const ALLOWED_ROLES = ['superadmin', 'admin', 'pembina', 'instruktur'] as const;
export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export function isAllowedRole(role: unknown): role is AllowedRole {
  return typeof role === 'string' && (ALLOWED_ROLES as readonly string[]).includes(role);
}

export function isSchoolRole(role: unknown): role is SchoolRole {
  return typeof role === 'string' && (SCHOOL_ROLES as readonly string[]).includes(role);
}
