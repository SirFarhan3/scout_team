import { NextResponse } from 'next/server';
import { dbAll, dbOne } from '@/lib/turso';
import { PAID_PLANS } from '@/lib/plans';
import { handleApiError, requireAuth } from '@/lib/authServer';

export async function GET() {
  try {
    const ctx = await requireAuth({ requireSchool: true });

    const [studentRes, userRes, invoices] = await Promise.all([
      dbOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?`, [
        ctx.school!.id,
      ]),
      dbOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM users WHERE school_id = ?`, [
        ctx.school!.id,
      ]),
      dbAll<Record<string, unknown>>(
        `SELECT id, invoice_number, school_id, plan_code, billing_cycle, amount_idr, status,
                payment_method, payment_reference, payer_note, admin_note, verified_at, created_at
         FROM subscription_invoices
         WHERE school_id = ?
         ORDER BY created_at DESC
         LIMIT 30`,
        [ctx.school!.id]
      ),
    ]);

    return NextResponse.json({
      success: true,
      school: ctx.school,
      usage: {
        student_count: Number(studentRes?.cnt) || 0,
        user_count: Number(userRes?.cnt) || 0,
      },
      plans: PAID_PLANS,
      invoices: invoices || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
