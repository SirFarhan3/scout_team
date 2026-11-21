'use client';

import React, { useEffect, useState } from 'react';
import { App, Button } from 'antd';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import PasswordInput from '@/components/PasswordInput';
import { authService, UserSessionData } from '@/lib/auth';
import { billingService } from '@/services/billingService';

export default function PengaturanPage() {
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Profil Sekolah (khusus admin sekolah)
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [gugusdepan, setGugusdepan] = useState('');
  const [npsn, setNpsn] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingSchool, setSavingSchool] = useState(false);

  // Ganti Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const user = await authService.getCurrentUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }
        setCurrentUser(user);
        setAdminUsername(user.username || '');
        if (user.school) {
          setName(user.school.name || '');
          setCity(user.school.city || '');
          setGugusdepan(user.school.gugusdepan || '');
          setNpsn(user.school.npsn || '');
          setAddress(user.school.address || '');
          setContactName(user.full_name || user.school.contact_name || '');
          setContactPhone(user.school.contact_phone || '');
          setContactEmail(user.school.contact_email || '');
          setTelegramChatId(
            user.school.telegram_chat_id ? String(user.school.telegram_chat_id) : ''
          );
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSchool(true);
      await billingService.updateSchoolProfile({
        name,
        city,
        gugusdepan,
        npsn,
        address,
        contact_name: contactName,
        admin_username: adminUsername,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        telegram_chat_id: telegramChatId,
      });
      message.success('Profil sekolah berhasil disimpan!');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan profil sekolah.');
    } finally {
      setSavingSchool(false);
    }
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
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal mengganti password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <PageLoader text="Memuat Pengaturan..." />;
  }

  const isSchoolAdmin = currentUser?.role === 'admin' && Boolean(currentUser.school);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <Header
          title="Pengaturan Sekolah & Keamanan Akun"
          subtitle="Kelola identitas sekolah pada laporan & keamanan kata sandi akun Anda"
        />

        {isSchoolAdmin && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                🏫 Identitas Sekolah & Integrasi
              </h2>
              <p className="text-xs text-slate-400">
                Nama sekolah dan kota ini otomatis dipakai di header laporan Excel, cetak Program Kerja, dan kartu QR.
              </p>
            </div>

            <form onSubmit={handleSaveSchool} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nama Sekolah *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Kota / Kabupaten (Untuk Tanda Tangan Laporan) *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Gugusdepan
                </label>
                <input
                  type="text"
                  value={gugusdepan}
                  onChange={(e) => setGugusdepan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  NPSN
                </label>
                <input
                  type="text"
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Alamat Sekolah
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nama Lengkap Admin / Pembina Utama (Full Name) *
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Username Login Admin *
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Email Sekolah
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Telegram Chat ID Bot Log Harian (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={savingSchool}
                  className="bg-indigo-600 hover:!bg-indigo-700 rounded-xl h-10 px-6 text-xs font-bold"
                >
                  Simpan Profil Sekolah
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Ganti Password Akun Sendiri */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">🔐 Keamanan Akun & Ganti Password</h2>
            <p className="text-xs text-slate-400">
              Password wajib minimal 8 karakter dengan kombinasi huruf dan angka. Mengganti password akan otomatis mengeluarkan sesi di perangkat lain.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            <div className="sm:col-span-3 flex justify-end pt-2">
              <Button
                htmlType="submit"
                type="primary"
                loading={savingPassword}
                className="bg-emerald-600 hover:!bg-emerald-700 border-none rounded-xl h-10 px-6 text-xs font-bold"
              >
                Perbarui Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
