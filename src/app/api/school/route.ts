import { NextResponse } from 'next/server';
import { dbExec, dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText, assertSafeUsername } from '@/lib/sanitize';
import { ValidationError, handleApiError, requireAuth, toSchoolDTO } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function GET() {
  try {
    const ctx = await requireAuth({ requireSchool: true });

    const [studentRes, userRes] = await Promise.all([
      dbOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?`, [
        ctx.school!.id,
      ]),
      dbOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM users WHERE school_id = ?`, [
        ctx.school!.id,
      ]),
    ]);

    return NextResponse.json({
      success: true,
      school: ctx.school,
      usage: {
        student_count: Number(studentRes?.cnt) || 0,
        user_count: Number(userRes?.cnt) || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['admin'], requireSchool: true });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload tidak valid.');
    }

    const setClauses: string[] = ['updated_at = ?'];
    const args: Array<string | number | null> = [new Date().toISOString()];

    if (body.name !== undefined) {
      const name = assertSafeText(body.name, 'Nama Sekolah', 120)
        .replace(/\s+/g, ' ')
        .trim();
      if (name.length < 3) throw new ValidationError('Nama sekolah minimal 3 karakter.');
      const dupSchool = await dbOne<{ id: string; name: string }>(
        `SELECT id, name FROM schools WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? AND deleted_at IS NULL LIMIT 1`,
        [name, ctx.school!.id]
      );
      if (dupSchool) {
        throw new ValidationError(`Sekolah "${dupSchool.name}" sudah terdaftar di sistem.`);
      }
      setClauses.push('name = ?');
      args.push(name);
    }
    if (body.city !== undefined) {
      const city = assertSafeText(body.city, 'Kota/Kabupaten', 80);
      if (!city) throw new ValidationError('Kota/Kabupaten wajib diisi.');
      setClauses.push('city = ?');
      args.push(city);
    }
    if (body.npsn !== undefined) {
      setClauses.push('npsn = ?');
      args.push(assertSafeText(body.npsn, 'NPSN', 30) || null);
    }
    if (body.address !== undefined) {
      setClauses.push('address = ?');
      args.push(assertSafeText(body.address, 'Alamat Sekolah', 300) || null);
    }
    if (body.gugusdepan !== undefined) {
      setClauses.push('gugusdepan = ?');
      args.push(assertSafeText(body.gugusdepan, 'Gugusdepan', 100) || null);
    }
    const userSetClauses: string[] = [];
    const userArgs: Array<string> = [];

    if (body.contact_name !== undefined) {
      const cleanContactName = assertSafeText(
        body.contact_name,
        'Nama Lengkap Admin / Penanggung Jawab',
        120
      );
      setClauses.push('contact_name = ?');
      args.push(cleanContactName || null);
      if (cleanContactName && cleanContactName.length >= 2) {
        userSetClauses.push('full_name = ?');
        userArgs.push(cleanContactName);
      }
    }
    if (body.admin_username !== undefined) {
      const cleanUsername = assertSafeUsername(body.admin_username).toLowerCase();
      const dupUser = await dbOne<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1`,
        [cleanUsername, ctx.user.id]
      );
      if (dupUser) {
        throw new ValidationError('Username tersebut sudah digunakan oleh akun lain.');
      }
      userSetClauses.push('username = ?');
      userArgs.push(cleanUsername);
    }

    if (userSetClauses.length > 0) {
      await dbExec(
        `UPDATE users SET ${userSetClauses.join(', ')} WHERE id = ? AND school_id = ?`,
        [...userArgs, ctx.user.id, ctx.school!.id]
      );
    }
    if (body.contact_phone !== undefined) {
      setClauses.push('contact_phone = ?');
      args.push(assertSafeText(body.contact_phone, 'Nomor Telepon', 30) || null);
    }
    if (body.contact_email !== undefined) {
      setClauses.push('contact_email = ?');
      args.push(assertSafeText(body.contact_email, 'Email Sekolah', 120) || null);
    }
    if (body.telegram_chat_id !== undefined) {
      const rawChat = String(body.telegram_chat_id ?? '').trim();
      if (!rawChat) {
        setClauses.push('telegram_chat_id = ?');
        args.push(null);
      } else if (!/^-?\d{4,20}$/.test(rawChat)) {
        throw new ValidationError('Telegram Chat ID harus berupa angka yang valid.');
      } else {
        setClauses.push('telegram_chat_id = ?');
        args.push(Number(rawChat));
      }
    }

    args.push(ctx.school!.id);

    let updated: Record<string, unknown> | null = null;
    try {
      updated = await dbOne<Record<string, unknown>>(
        `UPDATE schools SET ${setClauses.join(', ')} WHERE id = ? RETURNING *`,
        args
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || '');
      if (msg.includes('telegram_chat_id')) {
        throw new ValidationError('Telegram Chat ID tersebut sudah digunakan oleh sekolah lain.');
      }
      throw error;
    }

    if (!updated) {
      throw new ValidationError('Sekolah tidak ditemukan.');
    }

    await logSecurityEvent({
      schoolId: ctx.school!.id,
      userId: ctx.user.id,
      action: 'SCHOOL_PROFILE_UPDATED',
      targetType: 'school',
      targetId: ctx.school!.id,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      school: toSchoolDTO(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
