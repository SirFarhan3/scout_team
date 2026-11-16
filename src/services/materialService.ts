import { supabase } from '@/lib/supabase';
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
  fromRow: number; // 1-based index (contoh: Page 1 -> 1)
  toRow: number;   // 1-based index (contoh: Page 1 -> 9)
}

export const materialService = {
  // Ambil semua materi (legacy/fallback)
  async getAllMaterials(): Promise<Material[]> {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Ambil daftar kategori unik untuk dropdown filter
  async getMaterialCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('materials')
      .select('category');

    if (error) throw error;
    const uniqueCategories = Array.from(
      new Set((data || []).map((item: any) => item.category).filter(Boolean))
    );
    return ['Semua Kategori', ...uniqueCategories];
  },

  /**
   * Query ke DB dengan parameter pagination (Server-Side Pagination):
   * - Page 1 (pageSize 9): range(0, 8)  -> Data ke 1 - 9
   * - Page 2 (pageSize 9): range(9, 17) -> Data ke 10 - 18
   * - dst.
   */
  async getPaginatedMaterials({
    page = 1,
    pageSize = 9,
    search = '',
    category = 'Semua Kategori',
  }: GetPaginatedMaterialsParams): Promise<PaginatedMaterialsResult> {
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('materials')
      .select('*', { count: 'exact' });

    // Filter kategori di level DB
    if (category && category !== 'Semua Kategori') {
      query = query.eq('category', category);
    }

    // Filter pencarian judul / deskripsi di level DB
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      const escaped = trimmedSearch.replace(/[%_]/g, '\\$&');
      query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const items = (data || []) as Material[];
    const total = count || 0;

    return {
      data: items,
      total,
      page: safePage,
      pageSize,
      fromRow: total === 0 ? 0 : from + 1,
      toRow: total === 0 ? 0 : Math.min(from + items.length, total),
    };
  },

  async createMaterial(material: Omit<Material, 'id' | 'created_at'>): Promise<Material> {
    const { data, error } = await supabase
      .from('materials')
      .insert([material])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateMaterial(
    id: string,
    material: Partial<Omit<Material, 'id' | 'created_at'>>
  ): Promise<Material> {
    const { data, error } = await supabase
      .from('materials')
      .update(material)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  },
};
