'use client';

import { useState } from 'react';
import { SunOutlined, MoonOutlined, CheckCircleFilled } from '@ant-design/icons';
import { authService } from '@/lib/auth';
import { formatIdr } from '@/lib/plans';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanCode } from '@/lib/subscription-plans';
import { useThemeMode } from '@/components/ThemeProvider';
import PasswordInput from '@/components/PasswordInput';

export default function RegisterSchoolPage() {
  const { mode, toggleTheme } = useThemeMode();

  const [schoolName, setSchoolName] = useState('');
  const [city, setCity] = useState('');
  const [gugusdepan, setGugusdepan] = useState('');
  const [npsn, setNpsn] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanCode>('trial');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      setLoading(true);
      const result = await authService.registerSchool({
        schoolName,
        city,
        gugusdepan,
        npsn,
        contactPhone,
        fullName,
        username,
        password,
        plan: selectedPlan,
        billingCycle: selectedPlan === 'pro' ? 'yearly' : 'monthly',
      });

      if (result.user.school?.subscription_active) {
        window.location.href = '/';
      } else {
        window.location.href = '/billing';
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mendaftarkan sekolah.');
    } finally {
      setLoading(false);
    }
  };

  const plans = Object.values(SUBSCRIPTION_PLANS);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex items-center justify-center font-sans">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-100 space-y-6 relative">
        <button
          type="button"
          onClick={toggleTheme}
          title={mode === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          className="absolute top-5 right-5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
        >
          {mode === 'dark' ? (
            <>
              <SunOutlined className="text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <MoonOutlined className="text-indigo-600" />
              <span>Dark</span>
            </>
          )}
        </button>

        <div className="text-center space-y-2 pr-12 sm:pr-0">
          <div className="h-14 w-44 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-sm px-2">
            <img
              src="/header_logo.jpg"
              alt="Logo ScoutFN"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            🏫 Pendaftaran Sekolah Baru
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Data sekolah terisolasi penuh dan akun Admin terikat eksklusif untuk 1 sekolah.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          {/* Pilihan Paket */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-700 uppercase">
                1. Pilih Paket Langganan Sekolah
              </label>
              <span className="text-[11px] font-semibold text-indigo-600">
                ✨ Trial 7 Hari langsung aktif otomatis saat registrasi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const isSelected = selectedPlan === plan.code;

                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setSelectedPlan(plan.code)}
                    className={`relative text-left p-4 rounded-2xl border transition flex flex-col justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      {plan.isPopular && (
                        <div className="mb-1.5">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                            ⭐ Paket Andalan • Most Popular
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-indigo-700">
                          {plan.label} ({plan.durationLabel})
                        </span>
                        {isSelected && <CheckCircleFilled className="text-indigo-600" />}
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1">
                        {plan.price === 0 ? 'Gratis (Rp 0)' : formatIdr(plan.price)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        {plan.priceSubtext}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 font-semibold pt-2 border-t border-slate-200/70 space-y-0.5">
                      <div>👥 Maks {plan.maxStudents} peserta • {plan.maxUsers} admin/pembina</div>
                      <div className="text-indigo-700 font-bold">
                        ✨ Kuota AI: {plan.aiPlanCredits}x generate
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data Sekolah */}
          <div className="space-y-3">
            <h2 className="text-xs font-extrabold text-slate-700 uppercase">
              2. Identitas Sekolah / Pangkalan
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Nama Sekolah *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: SMP Negeri 1 Bandung"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Kota / Kabupaten *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bandung"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Nama / Nomor Gugusdepan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Gugusdepan 01.023-01.024"
                  value={gugusdepan}
                  onChange={(e) => setGugusdepan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  NPSN & No. WhatsApp PIC (Opsional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="NPSN"
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="0812..."
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Akun Admin Pertama */}
          <div className="space-y-3">
            <h2 className="text-xs font-extrabold text-slate-700 uppercase">
              3. Akun Admin Sekolah Pertama
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Nama Lengkap Admin *
                </label>
                <input
                  type="text"
                  placeholder="Nama Pembina/Admin"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Username Unik *
                </label>
                <input
                  type="text"
                  placeholder="admin_smp1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Password Kuat (Min 8 char + angka) *
                </label>
                <PasswordInput
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {loading
              ? 'Mendaftarkan Sekolah...'
              : selectedPlan === 'trial'
              ? `🚀 Daftar & Mulai Uji Coba ${SUBSCRIPTION_PLANS.trial.durationDays} Hari`
              : '💳 Daftar & Lanjutkan ke Pembayaran / Aktivasi'}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-center">
          <a href="/login" className="text-xs font-bold text-indigo-600 hover:underline">
            ← Sudah punya akun sekolah? Masuk di sini
          </a>
        </div>
      </div>
    </div>
  );
}
