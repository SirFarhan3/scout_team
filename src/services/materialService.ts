import { supabase } from '@/lib/supabase';
import { Material } from '@/types/material';

export const materialService = {
  async getAllMaterials(): Promise<Material[]> {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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

  // Tambahkan fungsi update ini
  async updateMaterial(id: string, material: Partial<Omit<Material, 'id' | 'created_at'>>): Promise<Material> {
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