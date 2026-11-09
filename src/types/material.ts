export interface EquipmentItem {
  name: string;
  isMandatory: boolean;
}

export interface Material {
  id: string;
  title: string;
  category: string;
  description: string;
  equipment: EquipmentItem[];
  created_at: string;
}