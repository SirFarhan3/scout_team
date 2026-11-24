import type {
  BillingCycle,
  PaidPlanCode,
  SubscriptionPlanCode,
  SubscriptionStatus,
} from '@/lib/subscription-plans';

export type {
  BillingCycle,
  PaidPlanCode,
  SubscriptionPlanCode,
  SubscriptionStatus,
};

export interface SchoolDTO {
  id: string;
  name: string;
  slug: string;
  npsn?: string | null;
  city: string;
  address?: string | null;
  gugusdepan?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  subscription_plan: SubscriptionPlanCode;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string;
  subscription_expires_at: string;
  subscription_active: boolean;
  remaining_days: number;
  max_students: number;
  max_users: number;
  ai_features_enabled: boolean;
  ai_plan_credits: number;
  ai_topup_credits: number;
  ai_total_credits: number;
  telegram_chat_id?: number | null;
  created_at?: string;
}

export interface SchoolUsageStats {
  student_count: number;
  user_count: number;
}

export type InvoiceItemType = 'subscription' | 'topup';
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled';

export interface InvoiceDTO {
  id: string;
  invoice_number: string;
  school_id: string;
  school_name: string;
  gugusdepan?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  item_type: InvoiceItemType;
  item_code: string;
  item_name: string;
  item_description?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  amount: number;
  discount: number;
  total_amount: number;
  payment_method: string;
  status: InvoiceStatus;
  paid_at?: string | null;
  created_at: string;
}

export type VoucherType = 'plan' | 'ai_tokens' | 'extend_days';

export interface LicenseKeyDTO {
  id: string;
  code_preview: string;
  voucher_type: VoucherType;
  plan_code: PaidPlanCode;
  duration_days: number;
  ai_tokens: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at?: string | null;
  redeemed_by_school_id?: string | null;
  redeemed_at?: string | null;
  created_at: string;
}
