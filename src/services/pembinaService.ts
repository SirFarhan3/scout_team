import { apiFetch } from '@/lib/apiClient';
import { PembinaUser, CreatePembinaInput, UpdatePembinaInput } from '@/types/pembina';

export const pembinaService = {
  async getAllPembina(): Promise<PembinaUser[]> {
    const res = await apiFetch<{ success: true; pembinas: PembinaUser[] }>('/api/pembina');
    return res.pembinas || [];
  },

  async createPembina(input: CreatePembinaInput): Promise<PembinaUser> {
    const res = await apiFetch<{ success: true; pembina: PembinaUser }>('/api/pembina', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.pembina;
  },

  async updatePembina(input: UpdatePembinaInput): Promise<PembinaUser> {
    const res = await apiFetch<{ success: true; pembina: PembinaUser }>(
      `/api/pembina/${encodeURIComponent(input.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
    return res.pembina;
  },

  async deletePembina(id: string): Promise<void> {
    await apiFetch(`/api/pembina/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
