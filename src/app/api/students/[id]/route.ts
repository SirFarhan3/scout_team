import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText, assertValidUuid, extractQrCodeId } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';
import { formatStudentRow, resolveTeamIdByName } from '@/lib/domainHelpers';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const { id } = await context.params;
    const studentId = assertValidUuid(id, 'ID Siswa');

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Data pembaruan siswa tidak valid.');
    }

    const setClauses: string[] = [];
    const args: Array<string | null> = [];

    if (body.full_name !== undefined) {
      const fn = assertSafeText(body.full_name, 'Nama Lengkap', 120);
      if (!fn) throw new ValidationError('Nama lengkap wajib diisi.');
      setClauses.push('full_name = ?');
      args.push(fn);
    }
    if (body.class_name !== undefined) {
      const cn = assertSafeText(body.class_name, 'Kelas', 50);
      if (!cn) throw new ValidationError('Kelas wajib diisi.');
      setClauses.push('class_name = ?');
      args.push(cn);
    }
    if (body.nta !== undefined) {
      setClauses.push('nta = ?');
      args.push(body.nta ? assertSafeText(body.nta, 'NTA', 60) : null);
    }
    if (body.group_name !== undefined) {
      const teamId = await resolveTeamIdByName(schoolId, String(body.group_name || ''));
      setClauses.push('team_id = ?');
      args.push(teamId);
    }
    if (body.qr_code_id !== undefined) {
      const extractedQr = extractQrCodeId(body.qr_code_id);
      const safeQr = assertSafeText(extractedQr, 'QR Code ID', 120);
      if (!safeQr) {
        throw new ValidationError('QR Code ID tidak boleh kosong.');
      }
      const existingQr = await dbOne<{ id: string }>(
        `SELECT id FROM students WHERE LOWER(qr_code_id) = LOWER(?) AND id <> ? LIMIT 1`,
        [safeQr, studentId]
      );
      if (existingQr) {
        throw new ValidationError(
          `QR Code ID "${safeQr}" sudah terdaftar pada anggota lain.`
        );
      }
      setClauses.push('qr_code_id = ?');
      args.push(safeQr);
    }

    if (setClauses.length === 0) {
      throw new ValidationError('Tidak ada data yang diperbarui.');
    }

    args.push(studentId, schoolId);

    const updated = await dbOne<{ id: string }>(
      `UPDATE students SET ${setClauses.join(', ')} WHERE id = ? AND school_id = ? RETURNING id`,
      args
    );

    if (!updated) {
      throw new ValidationError('Data siswa tidak ditemukan pada sekolah Anda.');
    }

    const row = await dbOne<Record<string, unknown>>(
      `SELECT s.*, t.id AS _team_id, t.name AS _team_name, t.gender AS _team_gender
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id AND t.school_id = s.school_id
       WHERE s.id = ? AND s.school_id = ?
       LIMIT 1`,
      [studentId, schoolId]
    );

    if (!row) {
      throw new ValidationError('Data siswa tidak ditemukan pada sekolah Anda.');
    }

    return NextResponse.json({ success: true, student: formatStudentRow(row) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina'],
      requireSchool: true,
      requireActiveSubscription: true,
    });
    const schoolId = ctx.school!.id;
    const { id } = await context.params;
    const studentId = assertValidUuid(id, 'ID Siswa');

    const deleted = await dbAll<{ id: string }>(
      `DELETE FROM students WHERE id = ? AND school_id = ? RETURNING id`,
      [studentId, schoolId]
    );

    if (deleted.length === 0) {
      throw new ValidationError('Data siswa tidak ditemukan pada sekolah Anda.');
    }

    await logSecurityEvent({
      schoolId,
      userId: ctx.user.id,
      action: 'STUDENT_DELETED',
      targetType: 'student',
      targetId: studentId,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
