import { NextResponse } from 'next/server';
import { dbOne } from '@/lib/turso';
import { PAID_PLANS } from '@/lib/plans';
import { AI_TOPUP_PACKAGE_LIST } from '@/lib/payment-config';
import { listSchoolInvoices } from '@/lib/invoices';
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
      listSchoolInvoices(ctx.school!.id, 50),
    ]);

    return NextResponse.json({
      success: true,
      school: ctx.school,
      usage: {
        student_count: Number(studentRes?.cnt) || 0,
        user_count: Number(userRes?.cnt) || 0,
      },
      plans: PAID_PLANS,
      topupPackages: AI_TOPUP_PACKAGE_LIST,
      invoices: invoices || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
