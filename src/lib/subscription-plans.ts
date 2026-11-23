export type SubscriptionPlanCode = 'trial' | 'basic' | 'pro';
export type PaidPlanCode = 'basic' | 'pro';
export type SubscriptionStatus = 'pending' | 'trial' | 'active' | 'expired' | 'suspended';
export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlanConfig {
  code: SubscriptionPlanCode;
  label: string;
  name: string;
  tagline: string;
  price: number;
  priceSubtext: string;
  durationDays: number;
  durationLabel: string;
  maxStudents: number;
  maxUsers: number;
  aiPlanCredits: number;
  aiFeaturesEnabled: boolean;
  isPopular?: boolean;
  badgeText?: string;
  /** Compatibility fields for existing billing components */
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanCode, SubscriptionPlanConfig> = {
  trial: {
    code: 'trial',
    label: 'Trial',
    name: 'Paket Trial (7 Hari)',
    tagline: 'Didapat otomatis saat registrasi sekolah baru',
    price: 0,
    priceSubtext: 'Gratis 7 hari',
    durationDays: 7,
    durationLabel: '7 Hari',
    maxStudents: 40,
    maxUsers: 5,
    aiPlanCredits: 2,
    aiFeaturesEnabled: true,
    isPopular: false,
    monthlyPriceIdr: 0,
    yearlyPriceIdr: 0,
    features: [
      'Durasi aktif 7 hari sejak registrasi',
      'Maksimal 40 peserta pramuka',
      'Maksimal 5 akun admin/pembina',
      'Kuota AI 2x generate (Materi & Proker)',
      'Presensi QR Code, Klasemen Regu & Rekap Nilai',
    ],
  },
  basic: {
    code: 'basic',
    label: 'Basic',
    name: 'Paket Basic (6 Bulan)',
    tagline: 'Hemat Rp 20.000/bulan untuk pangkalan sekolah aktif',
    price: 120000,
    priceSubtext: '6 bulan (Rp 20.000 / bulan)',
    durationDays: 180,
    durationLabel: '6 Bulan (180 Hari)',
    maxStudents: 100,
    maxUsers: 7,
    aiPlanCredits: 3,
    aiFeaturesEnabled: true,
    isPopular: false,
    monthlyPriceIdr: 120000,
    yearlyPriceIdr: 120000,
    features: [
      'Durasi aktif 6 bulan (180 hari)',
      'Maksimal 100 peserta pramuka',
      'Maksimal 7 akun admin/pembina',
      'Kuota AI 3x generate (Materi & Proker)',
      'Presensi QR Code, Rekap Nilai Excel & Log Book',
    ],
  },
  pro: {
    code: 'pro',
    label: 'Pro',
    name: 'Paket Pro (1 Tahun)',
    tagline: 'Paket Andalan untuk gugus depan dengan kapasitas besar',
    price: 200000,
    priceSubtext: '1 tahun penuh (365 hari)',
    durationDays: 365,
    durationLabel: '1 Tahun (365 Hari)',
    maxStudents: 500,
    maxUsers: 10,
    aiPlanCredits: 7,
    aiFeaturesEnabled: true,
    isPopular: true,
    badgeText: 'Paket Andalan • Most Popular',
    monthlyPriceIdr: 200000,
    yearlyPriceIdr: 200000,
    features: [
      'Durasi aktif 1 tahun penuh (365 hari)',
      'Maksimal 500 peserta pramuka',
      'Maksimal 10 akun admin/pembina',
      'Kuota AI 7x generate (Materi & Proker)',
      'Integrasi Webhook Bot Telegram & Fitur Lengkap',
    ],
  },
};

export const PAID_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  SUBSCRIPTION_PLANS.basic,
  SUBSCRIPTION_PLANS.pro,
];

export function isPaidPlanCode(val: unknown): val is PaidPlanCode {
  return val === 'basic' || val === 'pro';
}

export function isSubscriptionPlanCode(val: unknown): val is SubscriptionPlanCode {
  return val === 'trial' || val === 'basic' || val === 'pro';
}

export function normalizePlanCode(val: unknown): SubscriptionPlanCode {
  const clean = typeof val === 'string' ? val.trim().toLowerCase() : '';
  if (clean === 'pro' || clean === 'enterprise') return 'pro';
  if (clean === 'basic') return 'basic';
  return 'trial';
}

export function getSubscriptionPlanConfig(plan: unknown): SubscriptionPlanConfig {
  return SUBSCRIPTION_PLANS[normalizePlanCode(plan)];
}
