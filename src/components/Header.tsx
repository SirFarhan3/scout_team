'use client';

import { useEffect, useState } from 'react';
import { App, Button, Dropdown, Modal } from 'antd';
import type { MenuProps } from 'antd';
import {
  SunOutlined,
  MoonOutlined,
  AppstoreOutlined,
  CreditCardOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { authService, UserSessionData } from '@/lib/auth';
import { useThemeMode } from '@/components/ThemeProvider';
import MobileBottomNav from '@/components/MobileBottomNav';
import PasswordInput from '@/components/PasswordInput';

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

  const roleLabel =
    currentUser?.role === 'instruktur' ? 'Pembantu Pembina' : currentUser?.role || '';

  const profileMenuItems: MenuProps['items'] = [
    ...(!isSuperadmin
      ? [
          { key: 'profil', icon: <UserOutlined />, label: 'Profil Saya' },
          { key: 'pengaturan', icon: <SettingOutlined />, label: 'Pengaturan' },
        ]
      : []),
    ...(isAdmin
      ? [{ key: 'billing', icon: <CreditCardOutlined />, label: 'Billing & Langganan' }]
      : []),
    { key: 'ganti-password', icon: <KeyOutlined />, label: 'Ganti Password' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
  ];

  const handleProfileMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profil') window.location.href = '/pengaturan#profil';
    else if (key === 'pengaturan') window.location.href = '/pengaturan';
    else if (key === 'billing') window.location.href = '/billing';
    else if (key === 'ganti-password') setShowPasswordModal(true);
    else if (key === 'logout') handleLogout();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      message.error('Konfirmasi password baru tidak cocok.');
      return;
    }
    try {
      setSavingPassword(true);
      const msg = await authService.changePassword(currentPassword, newPassword);
      message.success(msg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal mengganti password.');
    } finally {
      setSavingPassword(false);
    }
  };

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
            <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
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
                      href="/portal"
                      title="Portal Pilihan Modul (Manajemen & Translasi Sandi)"
                      className="hidden sm:inline-flex bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 transition items-center gap-1"
                    >
                      <AppstoreOutlined /> Portal
                    </a>
                    <a
                      href="/menu"
                      className="hidden sm:inline-flex bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 transition items-center gap-1"
                    >
                      Menu
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
              </div>

              {/* Pop Up Profil */}
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{ items: profileMenuItems, onClick: handleProfileMenuClick }}
                popupRender={(menuNode) => (
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-w-[240px]">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-sm font-black text-slate-900 truncate">
                        {currentUser.full_name}
                      </p>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 truncate">
                        {roleLabel}
                      </p>
                      {school && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{school.name}</p>
                      )}
                    </div>
                    <div className="p-1">{menuNode}</div>
                  </div>
                )}
              >
                <button
                  type="button"
                  title={`${currentUser.full_name} (${roleLabel})`}
                  aria-label="Menu Profil"
                  className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center text-base shadow-sm transition cursor-pointer shrink-0"
                >
                  <UserOutlined />
                </button>
              </Dropdown>
            </div>
          )}
        </div>
      </header>

      {!isSuperadmin && <MobileBottomNav />}

      <Modal
        title={<span className="font-bold text-sm">🔐 Ganti Password Akun</span>}
        open={showPasswordModal}
        onCancel={() => {
          setShowPasswordModal(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }}
        footer={null}
        centered
      >
        <form onSubmit={handleChangePassword} className="space-y-3 pt-2">
          <p className="text-xs text-slate-400">
            Password wajib minimal 8 karakter dengan kombinasi huruf dan angka. Mengganti password akan otomatis mengeluarkan sesi di perangkat lain.
          </p>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Password Saat Ini *
            </label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Password Baru *
            </label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Konfirmasi Password Baru *
            </label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => setShowPasswordModal(false)}
              className="rounded-xl text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={savingPassword}
              className="bg-emerald-600 hover:!bg-emerald-700 border-none rounded-xl text-xs font-bold"
            >
              Perbarui Password
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
