import { apiFetch } from '@/lib/apiClient';

export const dashboardService = {
  async getDashboardStats() {
    const res = await apiFetch<{
      success: true;
      stats: {
        hadirToday: number;
        izinSakitToday: number;
        belumAbsenToday: number;
        totalStudents?: number;
      };
    }>('/api/dashboard');
    return res.stats;
  },
};
