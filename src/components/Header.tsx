'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, UserSessionData } from '@/lib/auth';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({
  title = 'Manajemen Anggota Penggalang',
  subtitle = 'Sistem Informasi Scout Management • Gugusdepan',
}: HeaderProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
      window.location.href = '/login';
    } catch (error: any) {
      alert(`Gagal logout: ${error?.message || 'Terjadi kesalahan'}`);
    }
  };

  return (
    <header className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Branding & Title */}
      <a href='/'>
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-indigo-200">
            ⚜️
            </div>
            <div>
            <h1 className="text-xl font-black text-slate-900">{title}</h1>
            <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
            </div>
        </div>
      </a>

      {/* User Session Info Badge & Actions */}
      {currentUser && (
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <div className="pl-2">
            <p className="text-xs font-bold text-slate-800">{currentUser.full_name}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold tracking-wide uppercase text-indigo-600">
                ROLE: {currentUser.role} (@{currentUser.username})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => (window.location.href = '/scan')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <span>📷</span> Scan QR
            </button>
            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3.5 py-2 rounded-xl border border-rose-200 transition flex items-center gap-1.5"
            >
              Logout 🚪
            </button>
          </div>
        </div>
      )}
    </header>
  );
}