import { apiFetch } from '@/lib/apiClient';
import type {
  BillingCycle,
  InvoiceDTO,
  PaidPlanCode,
  SchoolDTO,
  SchoolUsageStats,
} from '@/types/school';
import type { PlanDefinition } from '@/lib/plans';

export const billingService = {
  async getBillingOverview() {
    return apiFetch<{
      success: true;
      school: SchoolDTO;
      usage: SchoolUsageStats;
      plans: PlanDefinition[];
      invoices: InvoiceDTO[];
    }>('/api/billing');
  },

  async createInvoice(input: {
    planCode: PaidPlanCode;
    billingCycle: BillingCycle;
    paymentReference?: string;
    payerNote?: string;
  }) {
    const res = await apiFetch<{ success: true; invoice: InvoiceDTO }>('/api/billing/invoice', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.invoice;
  },

  async redeemLicenseKey(licenseCode: string) {
    return apiFetch<{ success: true; message: string; school: SchoolDTO }>(
      '/api/billing/redeem',
      {
        method: 'POST',
        body: JSON.stringify({ licenseCode }),
      }
    );
  },

  async updateSchoolProfile(payload: Record<string, unknown>) {
    const res = await apiFetch<{ success: true; school: SchoolDTO }>('/api/school', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.school;
  },

  async getSchoolDetails() {
    return apiFetch<{ success: true; school: SchoolDTO; usage: SchoolUsageStats }>('/api/school');
  },
};
