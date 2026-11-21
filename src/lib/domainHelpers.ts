import 'server-only';
import crypto from 'crypto';
import { dbOne } from '@/lib/turso';
import { assertSafeText } from '@/lib/sanitize';
import { ValidationError } from '@/lib/authServer';

export function formatStudentRow(row: Record<string, unknown>) {
  const { _team_id, _team_name, _team_gender, ...rest } = row;
  const team = _team_id
    ? {
        id: String(_team_id),
        name: String(_team_name || ''),
        gender: _team_gender ? String(_team_gender) : null,
      }
    : null;
  return {
    ...rest,
    team,
    group_name: team?.name || '-',
  };
}

export async function resolveTeamIdByName(
  schoolId: string,
  groupName?: string
): Promise<string | null> {
  const trimmed = assertSafeText(groupName || '', 'Nama Regu', 100);
  if (!trimmed || trimmed === '-') return null;

  const existing = await dbOne<{ id: string }>(
    `SELECT id FROM teams WHERE school_id = ? AND LOWER(name) = LOWER(?) LIMIT 1`,
    [schoolId, trimmed]
  );

  if (existing) {
    return String(existing.id);
  }

  try {
    const created = await dbOne<{ id: string }>(
      `INSERT INTO teams (id, school_id, name, gender, created_at)
       VALUES (?, ?, ?, 'Campuran', ?)
       RETURNING id`,
      [crypto.randomUUID(), schoolId, trimmed, new Date().toISOString()]
    );
    return created ? String(created.id) : null;
  } catch {
    return null;
  }
}

export function sanitizeProkerPayload(body: Record<string, unknown>) {
  const tahun_ajaran = assertSafeText(body?.tahun_ajaran, 'Tahun Ajaran', 40);
  const golongan = assertSafeText(body?.golongan, 'Golongan', 50);
  const nama_pangkalan = assertSafeText(body?.nama_pangkalan, 'Nama Pangkalan', 150);

  if (!tahun_ajaran || !golongan || !nama_pangkalan) {
    throw new ValidationError('Tahun ajaran, golongan, dan nama pangkalan wajib diisi.');
  }

  const rawActivities = Array.isArray(body?.kegiatan) ? body.kegiatan : [];
  const kegiatan = rawActivities.map((rawAct: unknown, idx: number) => {
    const act =
      rawAct && typeof rawAct === 'object' ? (rawAct as Record<string, unknown>) : {};
    return {
      ...(act.id ? { id: assertSafeText(String(act.id), `ID baris #${idx + 1}`, 80) } : {}),
      pekan_ke: assertSafeText(act.pekan_ke, `Pekan baris #${idx + 1}`, 80),
      durasi: assertSafeText(act.durasi, `Durasi baris #${idx + 1}`, 60),
      kegiatan: assertSafeText(act.kegiatan, `Kegiatan baris #${idx + 1}`, 500),
      ...(act.keterangan_kegiatan !== undefined
        ? {
            keterangan_kegiatan: assertSafeText(
              act.keterangan_kegiatan,
              `Keterangan baris #${idx + 1}`,
              1500
            ),
          }
        : {}),
      ...(act.ket_kegiatan !== undefined
        ? {
            ket_kegiatan: assertSafeText(act.ket_kegiatan, `Keterangan baris #${idx + 1}`, 1500),
          }
        : {}),
    };
  });

  return { tahun_ajaran, golongan, nama_pangkalan, kegiatan };
}
