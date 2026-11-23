import 'server-only';
import crypto from 'crypto';
import { dbExec, dbOne } from '@/lib/turso';
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPlanConfig,
  type SubscriptionPlanCode,
} from '@/lib/subscription-plans';

export type AiCreditSource = 'plan' | 'topup';
export type AiCreditLogType = 'usage' | 'plan_reset' | 'topup' | 'refund';

export interface SchoolAiCreditBalance {
  ai_plan_credits: number;
  ai_topup_credits: number;
  ai_total_credits: number;
}

/**
 * Kuota AI bawaan per periode paket langganan sekolah (Single Source of Truth dari SUBSCRIPTION_PLANS).
 */
export const AI_PLAN_CREDITS: Record<SubscriptionPlanCode, number> = {
  trial: SUBSCRIPTION_PLANS.trial.aiPlanCredits,
  basic: SUBSCRIPTION_PLANS.basic.aiPlanCredits,
  pro: SUBSCRIPTION_PLANS.pro.aiPlanCredits,
};

export function getPlanAiCredits(plan?: string | null): number {
  return getSubscriptionPlanConfig(plan).aiPlanCredits;
}

export async function getSchoolAiCredits(schoolId: string): Promise<SchoolAiCreditBalance> {
  const row = await dbOne<{ ai_plan_credits: number; ai_topup_credits: number }>(
    `SELECT ai_plan_credits, ai_topup_credits FROM schools WHERE id = ? LIMIT 1`,
    [schoolId]
  );
  const planCredits = Math.max(0, Number(row?.ai_plan_credits) || 0);
  const topupCredits = Math.max(0, Number(row?.ai_topup_credits) || 0);
  return {
    ai_plan_credits: planCredits,
    ai_topup_credits: topupCredits,
    ai_total_credits: planCredits + topupCredits,
  };
}

/**
 * 1. Atomic Reserve Credit (Mencegah Race Condition saat 2 Pembina di sekolah yang sama klik bersamaan)
 * Prioritas pemotongan:
 * - Kantong 1: ai_plan_credits
 * - Kantong 2: ai_topup_credits (jika ai_plan_credits == 0)
 */
export async function reserveAiCredit(
  schoolId: string
): Promise<{ success: true; source: AiCreditSource } | { success: false }> {
  const nowIso = new Date().toISOString();

  // Coba potong dari kuota paket (ai_plan_credits) secara atomic
  const planRes = await dbExec(
    `UPDATE schools
     SET ai_plan_credits = ai_plan_credits - 1, updated_at = ?
     WHERE id = ? AND ai_plan_credits > 0`,
    [nowIso, schoolId]
  );

  if (planRes.rowsAffected > 0) {
    return { success: true, source: 'plan' };
  }

  // Fallback: potong dari token top-up (ai_topup_credits) secara atomic
  const topupRes = await dbExec(
    `UPDATE schools
     SET ai_topup_credits = ai_topup_credits - 1, updated_at = ?
     WHERE id = ? AND ai_topup_credits > 0`,
    [nowIso, schoolId]
  );

  if (topupRes.rowsAffected > 0) {
    return { success: true, source: 'topup' };
  }

  return { success: false };
}

/**
 * 2. Commit Log Pemakaian AI (HANYA dipanggil setelah respon AI terbukti valid & tidak kosong)
 */
export async function commitAiCreditLog(
  schoolId: string,
  userId: string | null,
  source: AiCreditSource,
  feature: string
): Promise<SchoolAiCreditBalance> {
  const nowIso = new Date().toISOString();
  await dbExec(
    `INSERT INTO ai_credit_logs (id, school_id, user_id, type, source, amount, feature, created_at)
     VALUES (?, ?, ?, 'usage', ?, -1, ?, ?)`,
    [crypto.randomUUID(), schoolId, userId || null, source, feature, nowIso]
  );

  return getSchoolAiCredits(schoolId);
}

/**
 * 3. Auto-Refund Credit (Dipanggil di blok catch / validasi gagal bila AI error, timeout, atau hasil kosong)
 * Mengembalikan +1 ke kantong asal sehingga kegagalan AI TIDAK pernah mengurangi saldo sekolah.
 */
export async function refundAiCredit(
  schoolId: string,
  source: AiCreditSource
): Promise<void> {
  const col = source === 'plan' ? 'ai_plan_credits' : 'ai_topup_credits';
  await dbExec(
    `UPDATE schools SET ${col} = ${col} + 1, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), schoolId]
  );
}

/**
 * 4. Reset Kuota Paket (Dipanggil saat sekolah daftar, ganti paket, atau perpanjang langganan)
 * Hanya mereset ai_plan_credits tanpa menyentuh ai_topup_credits (rollover).
 */
export async function resetPlanAiCredits(
  schoolId: string,
  planCode: string,
  userId?: string | null,
  feature = 'subscription_reset'
): Promise<number> {
  const nextCredits = getPlanAiCredits(planCode);
  const nowIso = new Date().toISOString();

  await dbExec(
    `UPDATE schools SET ai_plan_credits = ?, updated_at = ? WHERE id = ?`,
    [nextCredits, nowIso, schoolId]
  );

  await dbExec(
    `INSERT INTO ai_credit_logs (id, school_id, user_id, type, source, amount, feature, created_at)
     VALUES (?, ?, ?, 'plan_reset', 'plan', ?, ?, ?)`,
    [crypto.randomUUID(), schoolId, userId || null, nextCredits, `${feature}:${planCode}`, nowIso]
  );

  return nextCredits;
}

/**
 * 5. Top-Up Token AI Tambahan (Saldo tidak hangus saat reset paket)
 */
export async function topupAiCredits(
  schoolId: string,
  amount: number,
  adminUserId?: string | null,
  feature = 'manual_topup'
): Promise<SchoolAiCreditBalance> {
  const cleanAmount = Math.floor(Number(amount) || 0);
  if (cleanAmount <= 0) {
    throw new Error('Jumlah top-up token AI harus lebih dari 0.');
  }

  const nowIso = new Date().toISOString();
  await dbExec(
    `UPDATE schools SET ai_topup_credits = ai_topup_credits + ?, updated_at = ? WHERE id = ?`,
    [cleanAmount, nowIso, schoolId]
  );

  await dbExec(
    `INSERT INTO ai_credit_logs (id, school_id, user_id, type, source, amount, feature, created_at)
     VALUES (?, ?, ?, 'topup', 'topup', ?, ?, ?)`,
    [crypto.randomUUID(), schoolId, adminUserId || null, cleanAmount, feature, nowIso]
  );

  return getSchoolAiCredits(schoolId);
}
