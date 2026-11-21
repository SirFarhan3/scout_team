import { apiFetch } from '@/lib/apiClient';
import type {
  InvoiceDTO,
  LicenseKeyDTO,
  PaidPlanCode,
  SchoolDTO,
  SubscriptionPlanCode,
  SubscriptionStatus,
} from '@/types/school';

export interface SuperadminSchoolItem extends SchoolDTO {
  student_count: number;
  user_count: number;
  admin_user_id?: string | null;
  admin_username?: string | null;
  admin_full_name?: string | null;
}

export const superadminService = {
  async getOverview() {
    return apiFetch<{
      success: true;
      schools: SuperadminSchoolItem[];
      invoices: InvoiceDTO[];
      licenseKeys: LicenseKeyDTO[];
      auditLogs: any[];
    }>('/api/superadmin/overview');
  },

  async createSchool(input: {
    schoolName: string;
    city: string;
    gugusdepan?: string;
    npsn?: string;
    adminFullName: string;
    adminUsername: string;
    adminPassword: string;
    plan: SubscriptionPlanCode;
    durationDays: number;
  }) {
    return apiFetch<{ success: true; school: SchoolDTO; adminUser: any }>(
      '/api/superadmin/schools',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async updateSchool(
    id: string,
    payload: {
      name?: string;
      city?: string;
      adminFullName?: string;
      adminUsername?: string;
      adminPassword?: string;
      subscription_plan?: SubscriptionPlanCode;
      subscription_status?: SubscriptionStatus;
      extendDays?: number;
      max_students?: number;
      max_users?: number;
      ai_features_enabled?: boolean;
    }
  ) {
    return apiFetch<{ success: true; school: SchoolDTO }>(
      `/api/superadmin/schools/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  async deleteSchool(id: string) {
    return apiFetch<{ success: true; message?: string }>(
      `/api/superadmin/schools/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  async processInvoice(id: string, action: 'approve' | 'reject', adminNote?: string) {
    return apiFetch<{ success: true; invoice: InvoiceDTO }>(
      `/api/superadmin/invoices/${encodeURIComponent(id)}`,
      {
        method: 'POST',
        body: JSON.stringify({ action, adminNote }),
      }
    );
  },

  async generateLicenseKey(input: {
    planCode: PaidPlanCode;
    durationDays: number;
    maxUses?: number;
  }) {
    return apiFetch<{ success: true; plainCode: string; licenseKey: LicenseKeyDTO }>(
      '/api/superadmin/license-keys',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async revokeLicenseKey(id: string) {
    return apiFetch<{ success: true }>(
      `/api/superadmin/license-keys/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
  },
};
