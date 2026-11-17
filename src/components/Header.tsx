'use client';

import { useEffect, useState } from 'react';
import { message } from 'antd';
import { SunOutlined, MoonOutlined, AppstoreOutlined } from '@ant-design/icons';
import { authService, UserSessionData } from '@/lib/auth';
import { useThemeMode } from '@/components/ThemeProvider';
import MobileBottomNav from '@/components/MobileBottomNav';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({
  title = 'Manajemen Anggota Penggalang',
  subtitle = 'Sistem Informasi Scout Management • Gugusdepan',
}: HeaderProps) {
  const { mode, toggleTheme } = useThemeMode();
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
      message.error(`Gagal logout: ${error?.message || 'Terjadi kesalahan'}`);
    }
  };

  return (
    <>
      <header className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 transition-colors">
        {/* Baris Atas Mobile: Branding + Toggle Tema Cepat */}
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="min-w-0 flex-1">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center shadow-md shrink-0">
                <img
                  src="/logo.jpg"
                  alt="Logo Scout Team"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-black text-slate-900 leading-snug truncate">
                  {title}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
                  {subtitle}
                </p>
              </div>
            </div>
          </a>

          {/* Tombol Toggle Tema khusus tampilan Mobile di kanan atas */}
          <button
            type="button"
            onClick={toggleTheme}
            title={mode === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            className="md:hidden bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold p-2.5 rounded-xl transition flex items-center justify-center shrink-0"
          >
            {mode === 'dark' ? (
              <SunOutlined className="text-amber-400 text-sm" />
            ) : (
              <MoonOutlined className="text-indigo-600 text-sm" />
            )}
          </button>
        </div>

        {/* Actions & User Session Info Badge */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Toggle Button Dark / Light Mode (Desktop) */}
          <button
            type="button"
            onClick={toggleTheme}
            title={
              mode === 'dark'
                ? 'Beralih ke Mode Terang (Light)'
                : 'Beralih ke Mode Gelap (Dark)'
            }
            className="hidden md:flex bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-2xl transition items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {mode === 'dark' ? (
              <>
                <SunOutlined className="text-amber-400 text-sm" />
                <span>Light</span>
              </>
            ) : (
              <>
                <MoonOutlined className="text-indigo-600 text-sm" />
                <span>Dark</span>
              </>
            )}
          </button>

          {currentUser && (
            <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200">
              <div className="min-w-0 pr-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {currentUser.full_name}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span className="text-[10px] font-bold tracking-wide uppercase text-indigo-600 truncate">
                    {currentUser.role} (@{currentUser.username})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href="/menu"
                  className="hidden sm:inline-flex bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 transition items-center gap-1"
                >
                  <AppstoreOutlined /> Menu
                </a>
                <button
                  onClick={() => (window.location.href = '/scan')}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm flex items-center gap-1"
                >
                  <span>📷</span>
                  <span className="hidden xs:inline sm:inline">Scan QR</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3 py-2 rounded-xl border border-rose-200 transition flex items-center gap-1"
                >
                  <span>Logout</span>
                  <span className="hidden sm:inline">🚪</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Navigasi Bawah Khusus Layar HP */}
      <MobileBottomNav />
    </>
  );
}
