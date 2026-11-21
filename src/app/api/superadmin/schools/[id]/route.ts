import { NextResponse } from 'next/server';
import { dbExec, dbOne, hashPassword, toSqlBool } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import {
  assertSafeText,
  assertSafeUsername,
  assertStrongPassword,
  assertValidUuid,
} from '@/lib/sanitize';
import { PLAN_CATALOG, isSubscriptionPlanCode, isSubscriptionStatus } from '@/lib/plans';
import type { SubscriptionPlanCode } from '@/types/school';
import { revokeAllUserSessions } from '@/lib/session';
import { ValidationError, handleApiError, requireAuth, toSchoolDTO } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['superadmin'] });
    const { id } = await context.params;
    const schoolId = assertValidUuid(id, 'ID Sekolah');

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload tidak valid.');
    }

    const existing = await dbOne<Record<string, unknown>>(
      `SELECT * FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [schoolId]
    );

    if (!existing) {
      throw new ValidationError('Sekolah tidak ditemukan.');
    }

    const fields: Record<string, string | number | null> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const cleanName = assertSafeText(body.name, 'Nama Sekolah', 120)
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanName.length < 3) {
        throw new ValidationError('Nama sekolah minimal 3 karakter.');
      }
      const dupSchool = await dbOne<{ id: string; name: string }>(
        `SELECT id, name FROM schools WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? AND deleted_at IS NULL LIMIT 1`,
        [cleanName, schoolId]
      );
      if (dupSchool) {
        throw new ValidationError(`Sekolah "${dupSchool.name}" sudah terdaftar.`);
      }
      fields.name = cleanName;
    }
    if (body.city !== undefined) {
      fields.city = assertSafeText(body.city, 'Kota', 80);
    }
    if (body.subscription_plan !== undefined) {
      if (!isSubscriptionPlanCode(body.subscription_plan)) {
        throw new ValidationError('Paket langganan tidak valid.');
      }
      const nextPlan: SubscriptionPlanCode = body.subscription_plan;
      fields.subscription_plan = nextPlan;
      const planDef = PLAN_CATALOG[nextPlan];
      if (body.max_students === undefined) fields.max_students = planDef.maxStudents;
      if (body.max_users === undefined) fields.max_users = planDef.maxUsers;
    }
    if (body.subscription_status !== undefined) {
      if (!isSubscriptionStatus(body.subscription_status)) {
        throw new ValidationError('Status langganan tidak valid.');
      }
      fields.subscription_status = body.subscription_status;
    }
    if (body.extendDays !== undefined) {
      const days = Number(body.extendDays);
      if (Number.isNaN(days) || days < 1 || days > 3650) {
        throw new ValidationError('Jumlah hari perpanjangan harus antara 1 dan 3650.');
      }
      const nowMs = Date.now();
      const curMs = new Date(String(existing.subscription_expires_at)).getTime();
      const baseMs = !Number.isNaN(curMs) && curMs > nowMs ? curMs : nowMs;
      fields.subscription_expires_at = new Date(
        baseMs + days * 24 * 60 * 60 * 1000
      ).toISOString();
      if (body.subscription_status === undefined) {
        fields.subscription_status = 'active';
      }
    } else if (body.subscription_expires_at !== undefined) {
      const parsedDate = new Date(String(body.subscription_expires_at));
      if (Number.isNaN(parsedDate.getTime())) {
        throw new ValidationError('Tanggal kadaluarsa tidak valid.');
      }
      fields.subscription_expires_at = parsedDate.toISOString();
    }

    if (body.max_students !== undefined) {
      const ms = Number(body.max_students);
      if (Number.isNaN(ms) || ms < 1 || ms > 100000) {
        throw new ValidationError('Kuota siswa tidak valid.');
      }
      fields.max_students = ms;
    }
    if (body.max_users !== undefined) {
      const mu = Number(body.max_users);
      if (Number.isNaN(mu) || mu < 1 || mu > 10000) {
        throw new ValidationError('Kuota user tidak valid.');
      }
      fields.max_users = mu;
    }
    if (body.ai_features_enabled !== undefined) {
      fields.ai_features_enabled = toSqlBool(Boolean(body.ai_features_enabled));
    }

    // Update Nama Lengkap Admin, Username Admin & Reset Password Admin Sekolah (opsional) jika dikirim
    const hasAdminFullName = body.adminFullName !== undefined;
    const hasAdminUsername = body.adminUsername !== undefined;
    const hasAdminPassword =
      typeof body.adminPassword === 'string' && body.adminPassword.trim() !== '';

    if (hasAdminFullName || hasAdminUsername || hasAdminPassword) {
      const schoolAdmin = await dbOne<{ id: string; username: string; full_name: string }>(
        `SELECT id, username, full_name
         FROM users
         WHERE school_id = ? AND role = 'admin'
         ORDER BY created_at ASC
         LIMIT 1`,
        [schoolId]
      );

      const userSetClauses: string[] = [];
      const userArgs: Array<string> = [];

      if (hasAdminFullName) {
        const cleanAdminFullName = assertSafeText(
          body.adminFullName,
          'Nama Lengkap Admin',
          120
        );
        if (cleanAdminFullName.length < 2) {
          throw new ValidationError('Nama lengkap admin minimal 2 karakter.');
        }
        fields.contact_name = cleanAdminFullName;
        if (schoolAdmin) {
          userSetClauses.push('full_name = ?');
          userArgs.push(cleanAdminFullName);
        }
      }

      if (hasAdminUsername && schoolAdmin) {
        const cleanAdminUsername = assertSafeUsername(body.adminUsername).toLowerCase();
        const dupUser = await dbOne<{ id: string }>(
          `SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1`,
          [cleanAdminUsername, String(schoolAdmin.id)]
        );
        if (dupUser) {
          throw new ValidationError('Username admin tersebut sudah digunakan oleh akun lain.');
        }
        userSetClauses.push('username = ?');
        userArgs.push(cleanAdminUsername);
      }

      if (hasAdminPassword && schoolAdmin) {
        const strongPass = assertStrongPassword(body.adminPassword, 'Password Baru Admin');
        const hashedPass = await hashPassword(strongPass);
        userSetClauses.push(
          'password_hash = ?',
          'token_version = token_version + 1',
          'failed_login_attempts = 0',
          'locked_until = NULL'
        );
        userArgs.push(hashedPass);
      }

      if (schoolAdmin && userSetClauses.length > 0) {
        await dbExec(
          `UPDATE users SET ${userSetClauses.join(', ')} WHERE id = ? AND school_id = ?`,
          [...userArgs, String(schoolAdmin.id), schoolId]
        );

        if (hasAdminPassword) {
          await revokeAllUserSessions(String(schoolAdmin.id));
        }
      }
    }

    const entries = Object.entries(fields);
    const setSql = entries.map(([k]) => `${k} = ?`).join(', ');
    const args = [...entries.map(([, v]) => v), schoolId];

    const updated = await dbOne<Record<string, unknown>>(
      `UPDATE schools SET ${setSql} WHERE id = ? RETURNING *`,
      args
    );

    if (!updated) {
      throw new Error('Gagal memperbarui sekolah.');
    }

    await logSecurityEvent({
      schoolId,
      userId: ctx.user.id,
      action: 'SUPERADMIN_UPDATED_SCHOOL',
      targetType: 'school',
      targetId: schoolId,
      ipAddress: getClientIp(request),
      metadata: fields,
    });

    return NextResponse.json({ success: true, school: toSchoolDTO(updated) });
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
    const ctx = await requireAuth({ roles: ['superadmin'] });
    const { id } = await context.params;
    const schoolId = assertValidUuid(id, 'ID Sekolah');

    const existing = await dbOne<{ id: string; name: string }>(
      `SELECT id, name FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [schoolId]
    );

    if (!existing) {
      throw new ValidationError('Sekolah tidak ditemukan atau sudah dihapus.');
    }

    const nowIso = new Date().toISOString();

    await dbExec(
      `UPDATE schools
       SET deleted_at = ?, subscription_status = 'suspended', telegram_chat_id = NULL, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [nowIso, nowIso, schoolId]
    );

    // Nonaktifkan semua akun milik sekolah ini, cabut sesi, dan bebaskan username agar bisa dipakai ulang
    await dbExec(
      `UPDATE users
       SET is_active = 0,
           token_version = token_version + 1,
           username = CASE
             WHEN username LIKE '%__deleted__%' THEN username
             ELSE username || '__deleted__' || SUBSTR(id, 1, 8)
           END
       WHERE school_id = ?`,
      [schoolId]
    );

    await dbExec(
      `UPDATE user_sessions SET revoked_at = ? WHERE school_id = ? AND revoked_at IS NULL`,
      [nowIso, schoolId]
    );

    await logSecurityEvent({
      schoolId,
      userId: ctx.user.id,
      action: 'SUPERADMIN_SOFT_DELETED_SCHOOL',
      targetType: 'school',
      targetId: schoolId,
      ipAddress: getClientIp(request),
      metadata: { schoolName: existing.name, deletedAt: nowIso },
    });

    return NextResponse.json({
      success: true,
      message: `Sekolah "${existing.name}" berhasil dihapus (soft delete).`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
