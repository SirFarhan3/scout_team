'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { authService, UserSessionData } from '@/lib/auth';
import { dashboardService } from '@/services/dashboardService';
import { attendanceService } from '@/services/attendanceService';
import { AttendanceRecord } from '@/types/attendance';
import StatCards from '@/app/dashboard/components/StatCards';
import QuickActions from '@/app/dashboard/components/QuickActions';
import RecentActivityList from '@/app/dashboard/components/RecentActivityList';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    hadirToday: 0,
    izinSakitToday: 0,
    belumAbsenToday: 0,
  });
  const [recentScans, setRecentScans] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    initDashboard();
  }, []);

  const initDashboard = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setCurrentUser(user);

      const [dashboardStats, attendanceHistory] = await Promise.all([
        dashboardService.getDashboardStats(),
        attendanceService.getRecentAttendance(5),
      ]);

      setStats(dashboardStats);
      setRecentScans(attendanceHistory);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl shadow-lg border border-slate-100">
          <span className="animate-spin text-2xl">⚡</span>
          <span className="text-sm font-bold text-slate-700">Memuat Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Global */}
        <Header 
          title="Dashboard Scout Management" 
          subtitle={`Selamat datang kembali, ${currentUser?.full_name || 'Pembina'}!`} 
        />

        {/* 📊 Stat Cards Component */}
        <StatCards 
          hadirToday={stats.hadirToday}
          izinSakitToday={stats.izinSakitToday}
          belumAbsenToday={stats.belumAbsenToday}
        />

        {/* 🚀 Quick Actions & Recent Scans Components */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActions isAdmin={currentUser?.role === 'admin'} />
          <RecentActivityList recentScans={recentScans} />
        </div>

      </div>
    </div>
  );
}