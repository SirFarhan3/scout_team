import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbAll, dbExec, toBool } from '@/lib/turso';
import { listAllInvoices } from '@/lib/invoices';
import { handleApiError, requireAuth, toSchoolDTO } from '@/lib/authServer';

export async function GET() {
  try {
    await requireAuth({ roles: ['superadmin'] });

    const [
      schools,
      studentCountRows,
      userCountRows,
      adminRows,
      invoices,
      licenseKeys,
      auditLogs,
    ] = await Promise.all([
      dbAll<Record<string, unknown>>(
        `SELECT * FROM schools WHERE deleted_at IS NULL ORDER BY created_at DESC`
      ),
      dbAll<{ school_id: string; cnt: number }>(
        `SELECT school_id, COUNT(*) AS cnt FROM students GROUP BY school_id`
      ),
      dbAll<{ school_id: string; cnt: number }>(
        `SELECT school_id, COUNT(*) AS cnt FROM users WHERE school_id IS NOT NULL GROUP BY school_id`
      ),
      dbAll<{ id: string; school_id: string; username: string; full_name: string }>(
        `SELECT id, school_id, username, full_name
         FROM users
         WHERE school_id IS NOT NULL AND role = 'admin'
         ORDER BY created_at ASC`
      ),
      listAllInvoices(150),
      dbAll<Record<string, unknown>>(
        `SELECT id, code_preview, voucher_type, plan_code, duration_days, ai_tokens,
                max_uses, used_count, is_active, expires_at, redeemed_by_school_id, redeemed_at, created_at
         FROM license_keys
         ORDER BY created_at DESC
         LIMIT 100`
      ),
        dbAll<Record<string, unknown>>(
          `SELECT id, school_id, user_id, action, target_type, target_id, ip_address, created_at
           FROM security_audit_logs
           ORDER BY created_at DESC
           LIMIT 40`
        ),
      ]);

    const studentCounts = new Map<string, number>();
    for (const r of studentCountRows) {
      studentCounts.set(String(r.school_id), Number(r.cnt) || 0);
    }
    const userCounts = new Map<string, number>();
    for (const r of userCountRows) {
      if (r.school_id) {
        userCounts.set(String(r.school_id), Number(r.cnt) || 0);
      }
    }
    const adminBySchool = new Map<
      string,
      { id: string; username: string; full_name: string }
    >();
    for (const adm of adminRows) {
      const sid = String(adm.school_id);
      if (!adminBySchool.has(sid)) {
        adminBySchool.set(sid, {
          id: String(adm.id),
          username: String(adm.username),
          full_name: String(adm.full_name),
        });
      }
    }

    const enrichedSchools = schools.map((s) => {
      const dto = toSchoolDTO(s);
      const adm = adminBySchool.get(dto.id);
      return {
        ...dto,
        student_count: studentCounts.get(dto.id) || 0,
        user_count: userCounts.get(dto.id) || 0,
        admin_user_id: adm?.id || null,
        admin_username: adm?.username || null,
        admin_full_name: adm?.full_name || dto.contact_name || null,
      };
    });

    const formattedLicenseKeys = await Promise.all(
      licenseKeys.map(async (k) => {
        let codePreview = String(k.code_preview || '');
        if (codePreview.includes('*')) {
          const prefix = /^[A-Z]{3}/.test(codePreview) ? codePreview.slice(0, 3) : 'SCT';
          const suffix = /[A-Z0-9]{4}$/.test(codePreview)
            ? codePreview.slice(-4)
            : crypto.randomBytes(2).toString('hex').toUpperCase();
          const mid1 = crypto.randomBytes(2).toString('hex').toUpperCase();
          const mid2 = crypto.randomBytes(2).toString('hex').toUpperCase();
          const repairedCode = `${prefix}-${mid1}-${mid2}-${suffix}`;
          const repairedHash = crypto
            .createHash('sha256')
            .update(repairedCode)
            .digest('hex');
          await dbExec(
            `UPDATE license_keys SET code_preview = ?, code_hash = ? WHERE id = ?`,
            [repairedCode, repairedHash, String(k.id)]
          );
          codePreview = repairedCode;
        }
        return {
          ...k,
          code_preview: codePreview,
          voucher_type: k.voucher_type ? String(k.voucher_type) : 'plan',
          ai_tokens: Number(k.ai_tokens) || 0,
          is_active: toBool(k.is_active),
        };
      })
    );

    return NextResponse.json({
      success: true,
      schools: enrichedSchools,
      invoices,
      licenseKeys: formattedLicenseKeys,
      auditLogs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
