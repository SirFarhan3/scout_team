import { NextResponse } from 'next/server';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  createPendingInvoice,
  listAllInvoices,
  listSchoolInvoices,
} from '@/lib/invoices';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';

export async function GET() {
  try {
    const ctx = await requireAuth();
    if (ctx.user.role === 'superadmin') {
      const invoices = await listAllInvoices(150);
      return NextResponse.json({ success: true, invoices });
    }

    if (!ctx.school) {
      throw new ValidationError('Akun ini tidak terikat dengan sekolah.');
    }

    const invoices = await listSchoolInvoices(ctx.school.id, 50);
    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['admin'], requireSchool: true });

    const limit = checkRateLimit(`invoices:create:${ctx.school!.id}`, 15, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak pembuatan tagihan. Silakan tunggu ${limit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload pembuatan invoice tidak valid.');
    }

    const invoice = await createPendingInvoice(
      ctx.school!.id,
      body.itemType,
      body.itemCode
    );

    await logSecurityEvent({
      schoolId: ctx.school!.id,
      userId: ctx.user.id,
      action: 'INVOICE_CREATED',
      targetType: 'invoice',
      targetId: invoice.id,
      ipAddress: getClientIp(request),
      metadata: {
        invoiceNumber: invoice.invoice_number,
        itemType: invoice.item_type,
        itemCode: invoice.item_code,
        totalAmount: invoice.total_amount,
      },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
