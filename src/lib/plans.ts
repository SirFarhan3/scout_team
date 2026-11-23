import {
  PAID_SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLANS,
  getSubscriptionPlanConfig,
  isPaidPlanCode,
  isSubscriptionPlanCode,
  normalizePlanCode,
  type BillingCycle,
  type PaidPlanCode,
  type SubscriptionPlanCode,
  type SubscriptionPlanConfig,
  type SubscriptionStatus,
} from '@/lib/subscription-plans';

export type PlanDefinition = SubscriptionPlanConfig;

export {
  SUBSCRIPTION_PLANS,
  isPaidPlanCode,
  isSubscriptionPlanCode,
  normalizePlanCode,
  getSubscriptionPlanConfig,
};

export const PLAN_CATALOG: Record<SubscriptionPlanCode, PlanDefinition> = SUBSCRIPTION_PLANS;

export const PAID_PLANS: PlanDefinition[] = PAID_SUBSCRIPTION_PLANS;

export function isSubscriptionStatus(val: unknown): val is SubscriptionStatus {
  return (
    val === 'pending' ||
    val === 'trial' ||
    val === 'active' ||
    val === 'expired' ||
    val === 'suspended'
  );
}

export function getPlanPriceIdr(planCode: PaidPlanCode, _cycle?: BillingCycle): number {
  return SUBSCRIPTION_PLANS[planCode].price;
}

export function isSchoolSubscriptionActive(school: {
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
}): boolean {
  if (!school) return false;
  if (school.subscription_status !== 'active' && school.subscription_status !== 'trial') {
    return false;
  }
  if (!school.subscription_expires_at) return false;
  const expiresMs = new Date(school.subscription_expires_at).getTime();
  return !Number.isNaN(expiresMs) && expiresMs > Date.now();
}

export function getRemainingDays(expiresAt?: string | null): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
