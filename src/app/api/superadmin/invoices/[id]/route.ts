import { NextResponse } from 'next/server';
import { dbExec, dbOne, toSqlBool } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertSafeText, assertValidUuid } from '@/lib/sanitize';
import { PLAN_CATALOG, isPaidPlanCode } from '@/lib/plans';
import type { PaidPlanCode } from '@/types/school';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['superadmin'] });
    const { id } = await context.params;
    const invoiceId = assertValidUuid(id, 'ID Invoice');

    const body = await request.json().catch(() => null);
    const action = body?.action;
    const adminNote = assertSafeText(body?.adminNote || '', 'Catatan Admin', 300);

    if (action !== 'approve' && action !== 'reject') {
      throw new ValidationError('Aksi invoice tidak valid (harus approve atau reject).');
    }

    const newStatus = action === 'approve' ? 'paid' : 'rejected';
    const nowIso = new Date().toISOString();

    const invoice = await dbOne<Record<string, unknown>>(
      `UPDATE subscription_invoices
       SET status = ?, admin_note = ?, verified_by = ?, verified_at = ?
       WHERE id = ? AND status = 'pending'
       RETURNING *`,
      [newStatus, adminNote || null, ctx.user.id, nowIso, invoiceId]
    );

    if (!invoice) {
      throw new ValidationError('Invoice tidak ditemukan atau sudah diproses sebelumnya.');
    }

    if (action === 'approve') {
      if (!isPaidPlanCode(invoice.plan_code)) {
        throw new ValidationError('Paket pada invoice tidak valid.');
      }
      const invoicePlanCode: PaidPlanCode = invoice.plan_code;

      const schoolRow = await dbOne<Record<string, unknown>>(
        `SELECT * FROM schools WHERE id = ? LIMIT 1`,
        [String(invoice.school_id)]
      );

      if (!schoolRow) {
        throw new ValidationError('Sekolah tidak ditemukan.');
      }

      const planDef = PLAN_CATALOG[invoicePlanCode];
      const days = invoice.billing_cycle === 'yearly' ? 365 : 30;
      const nowMs = Date.now();
      const curMs = new Date(String(schoolRow.subscription_expires_at)).getTime();
      const isCurrentlyActive =
        (schoolRow.subscription_status === 'active' || schoolRow.subscription_status === 'trial') &&
        !Number.isNaN(curMs) &&
        curMs > nowMs;
      const baseMs = isCurrentlyActive ? curMs : nowMs;
      const nextExpiresAt = new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString();

      await dbExec(
        `UPDATE schools
         SET subscription_plan = ?, subscription_status = 'active', subscription_expires_at = ?,
             max_students = ?, max_users = ?, ai_features_enabled = ?, updated_at = ?
         WHERE id = ?`,
        [
          invoicePlanCode,
          nextExpiresAt,
          planDef.maxStudents,
          planDef.maxUsers,
          toSqlBool(planDef.aiFeaturesEnabled),
          nowIso,
          String(invoice.school_id),
        ]
      );
    }

    await logSecurityEvent({
      schoolId: String(invoice.school_id),
      userId: ctx.user.id,
      action: action === 'approve' ? 'INVOICE_APPROVED' : 'INVOICE_REJECTED',
      targetType: 'subscription_invoice',
      targetId: String(invoice.id),
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    return handleApiError(error);
  }
}
