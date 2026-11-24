export type AiTopupPackageCode = 'topup_10' | 'topup_25' | 'topup_50';

export interface AiTopupPackageConfig {
  code: AiTopupPackageCode;
  tokens: number;
  price: number;
  label: string;
  name: string;
  description: string;
  isPopular?: boolean;
}

export const AI_TOPUP_PACKAGES: Record<AiTopupPackageCode, AiTopupPackageConfig> = {
  topup_10: {
    code: 'topup_10',
    tokens: 10,
    price: 20000,
    label: '10 Token AI',
    name: 'Top-Up 10 Token AI',
    description: 'Penambahan 10 Token AI Sekolah (Saldo Rollover / Tidak Hangus)',
    isPopular: false,
  },
  topup_25: {
    code: 'topup_25',
    tokens: 25,
    price: 45000,
    label: '25 Token AI',
    name: 'Top-Up 25 Token AI',
    description: 'Penambahan 25 Token AI Sekolah (Hemat Rp 5.000 • Saldo Rollover / Tidak Hangus)',
    isPopular: true,
  },
  topup_50: {
    code: 'topup_50',
    tokens: 50,
    price: 75000,
    label: '50 Token AI',
    name: 'Top-Up 50 Token AI',
    description: 'Penambahan 50 Token AI Sekolah (Hemat Rp 25.000 • Saldo Rollover / Tidak Hangus)',
    isPopular: false,
  },
};

export const AI_TOPUP_PACKAGE_LIST: AiTopupPackageConfig[] = [
  AI_TOPUP_PACKAGES.topup_10,
  AI_TOPUP_PACKAGES.topup_25,
  AI_TOPUP_PACKAGES.topup_50,
];

export function isAiTopupPackageCode(val: unknown): val is AiTopupPackageCode {
  return val === 'topup_10' || val === 'topup_25' || val === 'topup_50';
}

export const PAYMENT_CONFIG = {
  issuerName: 'ScoutFN',
  issuerRole: 'Pengelola ScoutFN',
  issuerSubtitle: 'Platform Manajemen Gugusdepan & Kepramukaan Digital',
  adminWhatsApp:
    process.env.NEXT_PUBLIC_ADMIN_WA?.replace(/[^0-9]/g, '') || '6281234567890',
  bank: {
    bankName: process.env.NEXT_PUBLIC_BANK_NAME || 'Bank BCA / SeaBank / Mandiri',
    accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || '1234567890',
    accountHolder: process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER || 'Pengelola ScoutFN',
  },
  qrisImagePath: process.env.NEXT_PUBLIC_QRIS_IMAGE_PATH || '/images/qris-scoutfn.png',
  defaultPaymentMethod: 'Transfer Bank / QRIS',
};

export function buildWhatsAppPaymentConfirmUrl(params: {
  invoiceNumber: string;
  schoolName: string;
  itemName: string;
  totalAmountFormatted: string;
}): string {
  const waNumber = PAYMENT_CONFIG.adminWhatsApp;
  const text = [
    'Halo Admin *ScoutFN*, saya ingin mengonfirmasi pembayaran tagihan berikut:',
    '',
    `• *No. Invoice:* ${params.invoiceNumber}`,
    `• *Sekolah:* ${params.schoolName}`,
    `• *Item:* ${params.itemName}`,
    `• *Total Nominal:* ${params.totalAmountFormatted}`,
    '',
    'Berikut saya lampirkan bukti pembayarannya. Mohon diverifikasi dan diaktifkan. Terima kasih. 🙏',
  ].join('\n');

  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}
