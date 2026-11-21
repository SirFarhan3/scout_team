import { NextResponse } from 'next/server';
import { dbAll, toBool } from '@/lib/turso';
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
      dbAll<Record<string, unknown>>(
          `SELECT i.id, i.invoice_number, i.school_id, i.plan_code, i.billing_cycle,
                  i.amount_idr, i.status, i.payment_method, i.payment_reference,
                  i.payer_note, i.admin_note, i.verified_at, i.created_at,
                  s.name AS school_name
           FROM subscription_invoices i
           LEFT JOIN schools s ON s.id = i.school_id
           ORDER BY i.created_at DESC
           LIMIT 100`
        ),
        dbAll<Record<string, unknown>>(
          `SELECT id, code_preview, plan_code, duration_days, max_uses, used_count,
                  is_active, expires_at, redeemed_by_school_id, redeemed_at, created_at
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

    const formattedInvoices = invoices.map((inv) => ({
      ...inv,
      school_name: inv.school_name ? String(inv.school_name) : '-',
    }));

    const formattedLicenseKeys = licenseKeys.map((k) => ({
      ...k,
      is_active: toBool(k.is_active),
    }));

    return NextResponse.json({
      success: true,
      schools: enrichedSchools,
      invoices: formattedInvoices,
      licenseKeys: formattedLicenseKeys,
      auditLogs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
