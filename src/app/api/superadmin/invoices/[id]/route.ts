import { NextResponse } from 'next/server';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertValidUuid } from '@/lib/sanitize';
import { cancelPendingInvoice, markInvoiceAsPaid } from '@/lib/invoices';
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

    if (
      action !== 'approve' &&
      action !== 'mark_paid' &&
      action !== 'reject' &&
      action !== 'cancel'
    ) {
      throw new ValidationError('Aksi invoice tidak valid (harus approve/mark_paid atau reject/cancel).');
    }

    const isApprove = action === 'approve' || action === 'mark_paid';
    const invoice = isApprove
      ? await markInvoiceAsPaid(invoiceId, ctx.user.id)
      : await cancelPendingInvoice(invoiceId, { isSuperadmin: true });

    await logSecurityEvent({
      schoolId: invoice.school_id,
      userId: ctx.user.id,
      action: isApprove ? 'INVOICE_APPROVED' : 'INVOICE_CANCELLED',
      targetType: 'invoice',
      targetId: invoice.id,
      ipAddress: getClientIp(request),
      metadata: {
        invoiceNumber: invoice.invoice_number,
        itemType: invoice.item_type,
        itemCode: invoice.item_code,
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    return handleApiError(error);
  }
}
