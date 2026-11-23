import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText, extractQrCodeId } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { formatStudentRow, resolveTeamIdByName } from '@/lib/domainHelpers';

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth({
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const { searchParams } = new URL(request.url);
    const qr = searchParams.get('qr');

    if (qr) {
      const safeQr = assertSafeText(extractQrCodeId(qr), 'QR Code ID', 120);
      const row = await dbOne<Record<string, unknown>>(
        `SELECT s.*, t.id AS _team_id, t.name AS _team_name, t.gender AS _team_gender
         FROM students s
         LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = s.school_id
         WHERE s.school_id = ? AND LOWER(s.qr_code_id) = LOWER(?)
         LIMIT 1`,
        [schoolId, safeQr]
      );

      return NextResponse.json({
        success: true,
        student: row ? formatStudentRow(row) : null,
      });
    }

    const rows = await dbAll<Record<string, unknown>>(
      `SELECT s.*, t.id AS _team_id, t.name AS _team_name, t.gender AS _team_gender
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = s.school_id
       WHERE s.school_id = ?
       ORDER BY s.full_name COLLATE NOCASE ASC`,
      [schoolId]
    );

    return NextResponse.json({
      success: true,
      students: rows.map(formatStudentRow),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Data siswa tidak valid.');
    }

    const safeFullName = assertSafeText(body.full_name, 'Nama Lengkap', 120);
    const safeClassName = assertSafeText(body.class_name, 'Kelas', 50);
    const safeNta = body.nta ? assertSafeText(body.nta, 'NTA', 60) : null;
    const groupName = body.group_name ? assertSafeText(body.group_name, 'Nama Regu', 100) : '';

    if (!safeFullName || !safeClassName) {
      throw new ValidationError('Nama lengkap dan kelas wajib diisi.');
    }

    // Cek kuota siswa berdasarkan paket langganan sekolah
    const countRes = await dbOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?`,
      [schoolId]
    );
    const currentCount = Number(countRes?.cnt) || 0;

    if (currentCount >= ctx.school!.max_students) {
      const limitMsg = `Batas maksimal peserta untuk paket Anda (${ctx.school!.max_students} peserta) telah tercapai. Silakan upgrade paket.`;
      return NextResponse.json(
        {
          success: false,
          code: 'MAX_STUDENTS_REACHED',
          error: limitMsg,
          message: limitMsg,
        },
        { status: 403 }
      );
    }

    const teamId = await resolveTeamIdByName(schoolId, groupName);
    const studentId = crypto.randomUUID();
    const rawCustomQr = body.qr_code_id ? extractQrCodeId(body.qr_code_id) : '';
    const customQr = rawCustomQr ? assertSafeText(rawCustomQr, 'QR Code ID', 120) : '';

    if (customQr) {
      const existingQr = await dbOne<{ id: string }>(
        `SELECT id FROM students WHERE LOWER(qr_code_id) = LOWER(?) LIMIT 1`,
        [customQr]
      );
      if (existingQr) {
        throw new ValidationError(
          `QR Code ID "${customQr}" sudah terdaftar pada anggota lain. Gunakan kode QR yang berbeda.`
        );
      }
    }

    const finalQrCodeId =
      customQr || `SCT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const nowIso = new Date().toISOString();

    await dbOne(
      `INSERT INTO students (id, school_id, full_name, class_name, team_id, nta, qr_code_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [studentId, schoolId, safeFullName, safeClassName, teamId, safeNta, finalQrCodeId, nowIso]
    );

    const created = await dbOne<Record<string, unknown>>(
      `SELECT s.*, t.id AS _team_id, t.name AS _team_name, t.gender AS _team_gender
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = s.school_id
       WHERE s.id = ? AND s.school_id = ?
       LIMIT 1`,
      [studentId, schoolId]
    );

    if (!created) throw new Error('Gagal menambahkan anggota.');

    return NextResponse.json(
      { success: true, student: formatStudentRow(created) },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
