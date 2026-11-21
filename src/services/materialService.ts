import { apiFetch } from '@/lib/apiClient';
import { Material } from '@/types/material';

export interface GetPaginatedMaterialsParams {
  page: number;
  pageSize?: number;
  search?: string;
  category?: string;
}

export interface PaginatedMaterialsResult {
  data: Material[];
  total: number;
  page: number;
  pageSize: number;
  fromRow: number;
  toRow: number;
}

export const materialService = {
  async getAllMaterials(): Promise<Material[]> {
    const res = await apiFetch<{ success: true; data: Material[] }>('/api/materials?mode=all');
    return res.data || [];
  },

  async getMaterialCategories(): Promise<string[]> {
    const res = await apiFetch<{ success: true; categories: string[] }>(
      '/api/materials?mode=categories'
    );
    return res.categories || ['Semua Kategori'];
  },

  async getPaginatedMaterials({
    page = 1,
    pageSize = 9,
    search = '',
    category = 'Semua Kategori',
  }: GetPaginatedMaterialsParams): Promise<PaginatedMaterialsResult> {
    const params = new URLSearchParams({
      mode: 'paginated',
      page: String(Math.max(1, page)),
      pageSize: String(pageSize),
      search,
      category,
    });
    const res = await apiFetch<{ success: true; result: PaginatedMaterialsResult }>(
      `/api/materials?${params.toString()}`
    );
    return res.result;
  },

  async createMaterial(material: Omit<Material, 'id' | 'created_at'>): Promise<Material> {
    const res = await apiFetch<{ success: true; material: Material }>('/api/materials', {
      method: 'POST',
      body: JSON.stringify(material),
    });
    return res.material;
  },

  async updateMaterial(
    id: string,
    material: Partial<Omit<Material, 'id' | 'created_at'>>
  ): Promise<Material> {
    const res = await apiFetch<{ success: true; material: Material }>(
      `/api/materials/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(material),
      }
    );
    return res.material;
  },

  async deleteMaterial(id: string): Promise<void> {
    await apiFetch(`/api/materials/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
