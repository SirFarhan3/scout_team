'use client';

import { useEffect, useState } from 'react';
import { App } from 'antd';
import {
  SunOutlined,
  MoonOutlined,
  AppstoreOutlined,
  CreditCardOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { authService, UserSessionData } from '@/lib/auth';
import { useThemeMode } from '@/components/ThemeProvider';
import MobileBottomNav from '@/components/MobileBottomNav';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({
  title = 'Scout Management Portal',
  subtitle,
}: HeaderProps) {
  const { message } = App.useApp();
  const { mode, toggleTheme } = useThemeMode();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(() =>
    authService.getCachedUser()
  );

  useEffect(() => {
    const cached = authService.getCachedUser();
    if (cached) {
      setCurrentUser(cached);
      return;
    }
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

  const school = currentUser?.school;
  const resolvedSubtitle =
    subtitle ||
    (school
      ? `${school.name} • ${school.gugusdepan || school.city}`
      : currentUser?.role === 'superadmin'
      ? 'Platform Owner & Billing Control'
      : 'Sistem Informasi Scout Management');

  const isSuperadmin = currentUser?.role === 'superadmin';
  const isAdmin = currentUser?.role === 'admin';
  const showPaywallBanner = Boolean(school && !school.subscription_active);

  const getPlanBadge = () => {
    if (!school) return null;
    if (!school.subscription_active) {
      return (
        <a
          href="/billing"
          className="text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full hover:bg-rose-200 transition"
        >
          ⛔ Langganan Tidak Aktif
        </a>
      );
    }
    const isTrial = school.subscription_status === 'trial';
    const badgeClass = `text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border transition ${
      isTrial
        ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
    }`;
    const label = isTrial
      ? `Trial (${school.remaining_days}h)`
      : `${school.subscription_plan.toUpperCase()} (${school.remaining_days}h)`;

    if (!isAdmin) {
      return <span className={badgeClass}>{label}</span>;
    }

    return (
      <a href="/billing" className={badgeClass}>
        {label}
      </a>
    );
  };

  return (
    <>
      {showPaywallBanner && (
        <div className="bg-rose-600 text-white rounded-2xl p-3.5 sm:px-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="text-xs font-semibold">
            <strong className="font-black">⛔ Akses Sekolah Dibatasi:</strong> Masa aktif paket{' '}
            <span className="underline">{school?.name}</span> belum aktif atau sudah berakhir.
            {!isAdmin && ' Hubungi Admin Sekolah Anda untuk aktivasi/perpanjangan.'}
          </div>
          {isAdmin && (
            <a
              href="/billing"
              className="bg-white text-rose-700 hover:bg-rose-50 text-xs font-black px-4 py-2 rounded-xl transition shrink-0"
            >
              Aktifkan / Bayar Sekarang →
            </a>
          )}
        </div>
      )}

      <header className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 transition-colors">
        <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
          <div className="min-w-0 flex-1 flex items-center gap-3 sm:gap-4">
            <a
              href={isSuperadmin ? '/superadmin' : '/'}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center shadow-md shrink-0"
            >
              <img
                src="/logo.jpg"
                alt="Logo Scout Team"
                className="w-full h-full object-contain"
              />
            </a>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={isSuperadmin ? '/superadmin' : '/'} className="min-w-0 max-w-full">
                  <h1 className="text-base sm:text-xl font-black text-slate-900 leading-snug truncate">
                    {title}
                  </h1>
                </a>
                {getPlanBadge()}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
                {resolvedSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            title={mode === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            className="lg:hidden bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold p-2.5 rounded-xl transition flex items-center justify-center shrink-0"
          >
            {mode === 'dark' ? (
              <SunOutlined className="text-amber-400 text-sm" />
            ) : (
              <MoonOutlined className="text-indigo-600 text-sm" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            title={
              mode === 'dark'
                ? 'Beralih ke Mode Terang (Light)'
                : 'Beralih ke Mode Gelap (Dark)'
            }
            className="hidden lg:flex bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-2xl transition items-center gap-1.5 shrink-0 cursor-pointer"
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
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 shrink-0">
              <div className="min-w-[110px] max-w-[180px] pr-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {currentUser.full_name}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span className="text-[10px] font-bold tracking-wide uppercase text-indigo-600 truncate">
                    {currentUser.role === 'instruktur' ? 'Pembantu Pembina' : currentUser.role} (@{currentUser.username})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {isSuperadmin ? (
                  <a
                    href="/superadmin"
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 transition inline-flex items-center gap-1"
                  >
                    <SafetyCertificateOutlined /> Superadmin
                  </a>
                ) : (
                  <>
                    <a
                      href="/menu"
                      className="hidden sm:inline-flex bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 transition items-center gap-1"
                    >
                      <AppstoreOutlined /> Menu
                    </a>
                    {isAdmin && (
                      <a
                        href="/billing"
                        title="Langganan & Pembayaran Sekolah"
                        className="hidden sm:inline-flex bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-2 rounded-xl border border-amber-200 transition items-center gap-1"
                      >
                        <CreditCardOutlined />
                      </a>
                    )}
                    <a
                      href="/pengaturan"
                      title="Pengaturan Sekolah & Keamanan Akun"
                      className="inline-flex bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-2 rounded-xl border border-slate-200 transition items-center gap-1"
                    >
                      <SettingOutlined />
                    </a>
                    {school?.subscription_active && (
                      <button
                        onClick={() => (window.location.href = '/scan')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm flex items-center gap-1"
                      >
                        <span>📷</span>
                        <span className="hidden xs:inline sm:inline">Scan QR</span>
                      </button>
                    )}
                  </>
                )}

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

      {!isSuperadmin && <MobileBottomNav />}
    </>
  );
}
