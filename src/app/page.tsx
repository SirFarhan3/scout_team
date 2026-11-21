'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import { dashboardService } from '@/services/dashboardService';
import { attendanceService } from '@/services/attendanceService';
import {
  getBestTeams,
  getBestStudents,
  BestTeamResult,
  BestStudentResult,
} from '@/services/scoreService';
import { AttendanceRecord } from '@/types/attendance';
import StatCards from '@/app/dashboard/components/StatCards';
import QuickActions from '@/app/dashboard/components/QuickActions';
import RankReguCard from '@/app/dashboard/components/RankReguCard';
import RankStudentCard from '@/app/dashboard/components/RankStudentCard';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    hadirToday: 0,
    izinSakitToday: 0,
    belumAbsenToday: 0,
  });
  const [recentScans, setRecentScans] = useState<AttendanceRecord[]>([]);
  const [bestTeams, setBestTeams] = useState<BestTeamResult[]>([]);
  const [bestStudents, setBestStudents] = useState<BestStudentResult[]>([]);

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
      if (user.role === 'superadmin') {
        window.location.href = '/superadmin';
        return;
      }
      if (user.school && !user.school.subscription_active) {
        window.location.href = '/billing';
        return;
      }
      setCurrentUser(user);

      const [dashboardStats, attendanceHistory, teamsData, studentsData] = await Promise.all([
        dashboardService.getDashboardStats(),
        attendanceService.getUniqueRecentAttendance(5),
        getBestTeams().catch(() => []),
        getBestStudents().catch(() => []),
      ]);

      setStats(dashboardStats);
      setRecentScans(attendanceHistory);
      setBestTeams(teamsData);
      setBestStudents(studentsData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoader text="Memuat Dashboard..." />;
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

        {/* 🚀 Quick Actions & Rank Regu Card Components */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Menu Pintasan (Lebar 1 kolom di layar medium/besar) */}
          <div className="md:col-span-1">
            <QuickActions isAdmin={currentUser?.role === 'admin'} />
          </div>

          {/* Leaderboard Regu Terbaik & Siswa Terbaik */}
          <div className="md:col-span-2 space-y-6">
            <RankReguCard initialTeams={bestTeams} initialStudents={bestStudents} />
            <RankStudentCard initialStudents={bestStudents} initialTeams={bestTeams} />
          </div>
        </div>

      </div>
    </div>
  );
}