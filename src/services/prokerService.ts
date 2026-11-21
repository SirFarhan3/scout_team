import { apiFetch } from '@/lib/apiClient';
import { ProkerItem } from '@/types/program-kerja';

export const prokerService = {
  async getAllProkers(): Promise<ProkerItem[]> {
    const res = await apiFetch<{ success: true; prokers: ProkerItem[] }>('/api/proker');
    return res.prokers || [];
  },

  async createProker(payload: Omit<ProkerItem, 'id' | 'created_at'>): Promise<ProkerItem> {
    const res = await apiFetch<{ success: true; proker: ProkerItem }>('/api/proker', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.proker;
  },

  async updateProker(id: string, payload: Omit<ProkerItem, 'id' | 'created_at'>): Promise<ProkerItem> {
    const res = await apiFetch<{ success: true; proker: ProkerItem }>(
      `/api/proker/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return res.proker;
  },

  async deleteProker(id: string): Promise<void> {
    await apiFetch(`/api/proker/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
