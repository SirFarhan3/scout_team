import type {
  BillingCycle,
  PaidPlanCode,
  SubscriptionPlanCode,
  SubscriptionStatus,
} from '@/types/school';

export interface PlanDefinition {
  code: SubscriptionPlanCode;
  name: string;
  tagline: string;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
  maxStudents: number;
  maxUsers: number;
  aiFeaturesEnabled: boolean;
  features: string[];
}

export const PLAN_CATALOG: Record<SubscriptionPlanCode, PlanDefinition> = {
  trial: {
    code: 'trial',
    name: 'Trial 14 Hari',
    tagline: 'Uji coba penuh untuk gugus depan baru',
    monthlyPriceIdr: 0,
    yearlyPriceIdr: 0,
    maxStudents: 40,
    maxUsers: 3,
    aiFeaturesEnabled: true,
    features: [
      'Maksimal 40 anggota pramuka',
      'Maksimal 3 akun admin/pembina',
      'Presensi QR & laporan nilai dasar',
      'Akses uji coba generator AI',
    ],
  },
  basic: {
    code: 'basic',
    name: 'Paket Gugus Depan (Basic)',
    tagline: 'Ideal untuk SD/MI atau pangkalan rintisan',
    monthlyPriceIdr: 99000,
    yearlyPriceIdr: 990000,
    maxStudents: 150,
    maxUsers: 8,
    aiFeaturesEnabled: true,
    features: [
      'Maksimal 150 anggota pramuka',
      'Maksimal 8 akun pengelola (Admin/Pembina/Pembantu Pembina)',
      'Presensi QR Code, Rekap Nilai Excel & Log Book',
      'Klasemen Regu, Siswa Terbaik & Manajemen Poin',
    ],
  },
  pro: {
    code: 'pro',
    name: 'Paket Pangkalan Aktif (Pro)',
    tagline: 'Untuk SMP/MTs, SMA/SMK, atau gugus depan besar',
    monthlyPriceIdr: 199000,
    yearlyPriceIdr: 1990000,
    maxStudents: 500,
    maxUsers: 25,
    aiFeaturesEnabled: true,
    features: [
      'Maksimal 500 anggota pramuka',
      'Maksimal 25 akun pengelola',
      'AI Generator Materi & Program Kerja Tahunan',
      'Integrasi Webhook Bot Telegram Log Harian',
    ],
  },
  enterprise: {
    code: 'enterprise',
    name: 'Paket Kwartir / Yayasan (Enterprise)',
    tagline: 'Kapasitas ekstra besar dengan dukungan prioritas',
    monthlyPriceIdr: 399000,
    yearlyPriceIdr: 3990000,
    maxStudents: 5000,
    maxUsers: 100,
    aiFeaturesEnabled: true,
    features: [
      'Hingga 5.000 anggota pramuka per sekolah',
      'Hingga 100 akun pembina & pembantu pembina',
      'Semua fitur AI, ekspor massal & Telegram Bot',
      'Dukungan onboarding & audit keamanan prioritas',
    ],
  },
};

export const PAID_PLANS: PlanDefinition[] = [
  PLAN_CATALOG.basic,
  PLAN_CATALOG.pro,
  PLAN_CATALOG.enterprise,
];

export function isPaidPlanCode(val: unknown): val is PaidPlanCode {
  return val === 'basic' || val === 'pro' || val === 'enterprise';
}

export function isSubscriptionPlanCode(val: unknown): val is SubscriptionPlanCode {
  return val === 'trial' || isPaidPlanCode(val);
}

export function isSubscriptionStatus(val: unknown): val is SubscriptionStatus {
  return (
    val === 'pending' ||
    val === 'trial' ||
    val === 'active' ||
    val === 'expired' ||
    val === 'suspended'
  );
}

export function getPlanPriceIdr(planCode: PaidPlanCode, cycle: BillingCycle): number {
  const plan = PLAN_CATALOG[planCode];
  return cycle === 'yearly' ? plan.yearlyPriceIdr : plan.monthlyPriceIdr;
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
