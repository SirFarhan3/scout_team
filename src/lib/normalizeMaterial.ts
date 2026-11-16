import { EquipmentItem } from '@/types/material';

export interface NormalizedMaterial {
  title: string;
  category: string;
  description: string;
  equipment: EquipmentItem[];
}

// Ubah nilai apa pun (string / array / object bersarang) menjadi teks biasa
function toText(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  const indent = '  '.repeat(depth);

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const text = toText(item, depth + 1);
        return text ? `${indent}• ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => {
        const text = toText(val, depth + 1);
        if (!text) return '';
        const isBlock = typeof val === 'object' && val !== null;
        return isBlock ? `${indent}${key}:\n${text}` : `${indent}${key}: ${text}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  return String(value);
}

function toBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', 'ya', 'yes', 'wajib', 'mandatory'].includes(v)) return true;
    if (['false', 'tidak', 'no', 'opsional', 'optional'].includes(v)) return false;
  }
  return fallback;
}

// Rapikan hasil AI agar sesuai dengan struktur tabel `materials`
export function normalizeAiMaterial(raw: any): NormalizedMaterial {
  const source = raw && typeof raw === 'object' ? raw : {};

  const rawEquipment = Array.isArray(source.equipment)
    ? source.equipment
    : Array.isArray(source.alat)
    ? source.alat
    : [];

  const equipment: EquipmentItem[] = rawEquipment
    .map((item: any): EquipmentItem | null => {
      if (typeof item === 'string') {
        return item.trim() ? { name: item.trim(), isMandatory: true } : null;
      }
      if (item && typeof item === 'object') {
        const name = toText(item.name ?? item.nama ?? item.item ?? item.alat);
        if (!name) return null;
        return {
          name,
          isMandatory: toBoolean(
            item.isMandatory ?? item.is_mandatory ?? item.mandatory ?? item.wajib,
            true
          ),
        };
      }
      return null;
    })
    .filter((item: EquipmentItem | null): item is EquipmentItem => item !== null);

  return {
    title: toText(source.title ?? source.judul),
    category: toText(source.category ?? source.kategori),
    description: toText(source.description ?? source.deskripsi),
    equipment,
  };
}
