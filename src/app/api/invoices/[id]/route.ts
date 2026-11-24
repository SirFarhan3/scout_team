import { NextResponse } from 'next/server';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { assertValidUuid } from '@/lib/sanitize';
import {
  cancelPendingInvoice,
  getInvoiceById,
  markInvoiceAsPaid,
} from '@/lib/invoices';
import { AuthError, ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';
import { getClientIp } from '@/lib/rateLimit';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await context.params;
    const invoiceId = assertValidUuid(id, 'ID Invoice');

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Dokumen invoice tidak ditemukan.' },
        { status: 404 }
      );
    }

    const isSuperadmin = ctx.user.role === 'superadmin';
    if (!isSuperadmin && (!ctx.school || invoice.school_id !== ctx.school.id)) {
      throw new AuthError(
        'Anda tidak memiliki izin untuk mengakses dokumen invoice sekolah lain.',
        403,
        'FORBIDDEN'
      );
    }

    return NextResponse.json({
      success: true,
      invoice,
      viewerRole: ctx.user.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth();
    const { id } = await context.params;
    const invoiceId = assertValidUuid(id, 'ID Invoice');

    const body = await request.json().catch(() => null);
    const action = body?.action;

    if (action !== 'mark_paid' && action !== 'cancel') {
      throw new ValidationError('Aksi invoice tidak valid (gunakan mark_paid atau cancel).');
    }

    const isSuperadmin = ctx.user.role === 'superadmin';

    if (action === 'mark_paid') {
      if (!isSuperadmin) {
        throw new AuthError(
          'Hanya Super Admin yang dapat mengonfirmasi pelunasan invoice.',
          403,
          'FORBIDDEN'
        );
      }

      const paidInvoice = await markInvoiceAsPaid(invoiceId, ctx.user.id);

      await logSecurityEvent({
        schoolId: paidInvoice.school_id,
        userId: ctx.user.id,
        action: 'INVOICE_MARKED_PAID',
        targetType: 'invoice',
        targetId: paidInvoice.id,
        ipAddress: getClientIp(request),
        metadata: {
          invoiceNumber: paidInvoice.invoice_number,
          itemType: paidInvoice.item_type,
          itemCode: paidInvoice.item_code,
          totalAmount: paidInvoice.total_amount,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Invoice ${paidInvoice.invoice_number} berhasil dikonfirmasi LUNAS!`,
        invoice: paidInvoice,
      });
    }

    // action === 'cancel'
    if (!isSuperadmin && ctx.user.role !== 'admin') {
      throw new AuthError(
        'Hanya Admin Sekolah atau Super Admin yang dapat membatalkan invoice.',
        403,
        'FORBIDDEN'
      );
    }

    const cancelledInvoice = await cancelPendingInvoice(invoiceId, {
      schoolId: ctx.school?.id,
      isSuperadmin,
    });

    await logSecurityEvent({
      schoolId: cancelledInvoice.school_id,
      userId: ctx.user.id,
      action: 'INVOICE_CANCELLED',
      targetType: 'invoice',
      targetId: cancelledInvoice.id,
      ipAddress: getClientIp(request),
      metadata: {
        invoiceNumber: cancelledInvoice.invoice_number,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice ${cancelledInvoice.invoice_number} telah dibatalkan.`,
      invoice: cancelledInvoice,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
