export type SubscriptionPlanCode = 'trial' | 'basic' | 'pro';
export type PaidPlanCode = 'basic' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'pending' | 'trial' | 'active' | 'expired' | 'suspended';
export type BillingCycle = 'monthly' | 'yearly';

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
  telegram_chat_id?: number | null;
  created_at?: string;
}

export interface SchoolUsageStats {
  student_count: number;
  user_count: number;
}

export interface InvoiceDTO {
  id: string;
  invoice_number: string;
  school_id: string;
  school_name?: string;
  plan_code: PaidPlanCode;
  billing_cycle: BillingCycle;
  amount_idr: number;
  status: 'pending' | 'paid' | 'rejected' | 'cancelled';
  payment_method: 'manual_transfer' | 'license_key' | 'superadmin_grant' | 'gateway';
  payment_reference?: string | null;
  payer_note?: string | null;
  admin_note?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface LicenseKeyDTO {
  id: string;
  code_preview: string;
  plan_code: PaidPlanCode;
  duration_days: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at?: string | null;
  redeemed_by_school_id?: string | null;
  redeemed_at?: string | null;
  created_at: string;
}
