import { apiFetch } from '@/lib/apiClient';
import type {
  InvoiceDTO,
  InvoiceItemType,
  SchoolDTO,
  SchoolUsageStats,
} from '@/types/school';
import type { PlanDefinition } from '@/lib/plans';
import type { AiTopupPackageConfig } from '@/lib/payment-config';

export const billingService = {
  async getBillingOverview() {
    return apiFetch<{
      success: true;
      school: SchoolDTO;
      usage: SchoolUsageStats;
      plans: PlanDefinition[];
      topupPackages: AiTopupPackageConfig[];
      invoices: InvoiceDTO[];
    }>('/api/billing');
  },

  async createPendingInvoice(input: {
    itemType: InvoiceItemType;
    itemCode: string;
  }) {
    const res = await apiFetch<{ success: true; invoice: InvoiceDTO }>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.invoice;
  },

  async getInvoiceById(id: string) {
    return apiFetch<{
      success: true;
      invoice: InvoiceDTO;
      viewerRole: string;
    }>(`/api/invoices/${encodeURIComponent(id)}`);
  },

  async cancelInvoice(id: string) {
    return apiFetch<{
      success: true;
      message: string;
      invoice: InvoiceDTO;
    }>(`/api/invoices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    });
  },

  async markInvoicePaid(id: string) {
    return apiFetch<{
      success: true;
      message: string;
      invoice: InvoiceDTO;
    }>(`/api/invoices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'mark_paid' }),
    });
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
