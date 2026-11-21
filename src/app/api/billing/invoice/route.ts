import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbOne } from '@/lib/turso';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { assertSafeText } from '@/lib/sanitize';
import { getPlanPriceIdr, isPaidPlanCode } from '@/lib/plans';
import { ValidationError, handleApiError, requireAuth } from '@/lib/authServer';
import { logSecurityEvent } from '@/lib/auditLog';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const ctx = await requireAuth({ roles: ['admin'], requireSchool: true });

    const limit = checkRateLimit(`billing:invoice:${ctx.school!.id}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan invoice. Silakan tunggu sebentar.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Payload invoice tidak valid.');
    }

    if (!isPaidPlanCode(body.planCode)) {
      throw new ValidationError('Pilihan paket berbayar tidak valid.');
    }
    const billingCycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const paymentReference = assertSafeText(body.paymentReference || '', 'Referensi Pembayaran', 120);
    const payerNote = assertSafeText(body.payerNote || '', 'Catatan Pembayaran', 300);

    const amountIdr = getPlanPriceIdr(body.planCode, billingCycle);
    const now = new Date();
    const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const invoice = await dbOne<Record<string, unknown>>(
      `INSERT INTO subscription_invoices (
         id, invoice_number, school_id, requested_by, plan_code, billing_cycle, amount_idr,
         status, payment_method, payment_reference, payer_note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'manual_transfer', ?, ?, ?)
       RETURNING *`,
      [
        crypto.randomUUID(),
        invoiceNumber,
        ctx.school!.id,
        ctx.user.id,
        body.planCode,
        billingCycle,
        amountIdr,
        paymentReference || null,
        payerNote || null,
        now.toISOString(),
      ]
    );

    if (!invoice) {
      throw new Error('Gagal membuat invoice pembayaran.');
    }

    await logSecurityEvent({
      schoolId: ctx.school!.id,
      userId: ctx.user.id,
      action: 'INVOICE_CREATED',
      targetType: 'subscription_invoice',
      targetId: String(invoice.id),
      ipAddress: getClientIp(request),
      metadata: { planCode: body.planCode, billingCycle, amountIdr },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
