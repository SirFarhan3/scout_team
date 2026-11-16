/**
 * Utilitas sanitasi sisi client & server untuk mencegah XSS pada output HTML dinamis
 * (seperti dokumen cetak / print window).
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
