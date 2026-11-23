'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Progress, Table, Tag } from 'antd';
import {
  CheckCircleFilled,
  KeyOutlined,
  CreditCardOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import { billingService } from '@/services/billingService';
import { formatIdr, PlanDefinition } from '@/lib/plans';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import type {
  BillingCycle,
  InvoiceDTO,
  PaidPlanCode,
  SchoolDTO,
  SchoolUsageStats,
} from '@/types/school';

export default function BillingPage() {
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [usage, setUsage] = useState<SchoolUsageStats>({ student_count: 0, user_count: 0 });
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Redeem Lisensi
  const [licenseCode, setLicenseCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Form Ajukan Invoice Pembayaran (Default ke Pro - Paket Andalan)
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanCode>('pro');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [paymentReference, setPaymentReference] = useState('');
  const [payerNote, setPayerNote] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  const fetchBillingData = async () => {
    const user = await authService.getCurrentUser();
    if (!user) {
      window.location.href = '/login';
      return null;
    }
    if (user.role === 'superadmin') {
      window.location.href = '/superadmin';
      return null;
    }
    const data = await billingService.getBillingOverview();
    return { user, data };
  };

  const loadBilling = async () => {
    try {
      setLoading(true);
      const res = await fetchBillingData();
      if (!res) return;
      setCurrentUser(res.user);
      setSchool(res.data.school);
      setUsage(res.data.usage);
      setPlans(res.data.plans);
      setInvoices(res.data.invoices);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal memuat informasi langganan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchBillingData()
      .then((res) => {
        if (!mounted || !res) return;
        setCurrentUser(res.user);
        setSchool(res.data.school);
        setUsage(res.data.usage);
        setPlans(res.data.plans);
        setInvoices(res.data.invoices);
      })
      .catch((err: unknown) => {
        if (mounted) {
          message.error(err instanceof Error ? err.message : 'Gagal memuat informasi langganan.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseCode.trim()) {
      message.warning('Masukkan kode lisensi terlebih dahulu.');
      return;
    }
    try {
      setRedeeming(true);
      const res = await billingService.redeemLicenseKey(licenseCode.trim());
      message.success(res.message);
      setLicenseCode('');
      await loadBilling();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal mengaktifkan kode lisensi.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingInvoice(true);
      await billingService.createInvoice({
        planCode: selectedPlan,
        billingCycle,
        paymentReference,
        payerNote,
      });
      message.success(
        'Invoice pembayaran berhasil dibuat! Silakan tunggu verifikasi Superadmin.'
      );
      setPaymentReference('');
      setPayerNote('');
      await loadBilling();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal membuat invoice pembayaran.');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  if (loading) {
    return <PageLoader text="Memuat Status Langganan..." />;
  }

  const isAdmin = currentUser?.role === 'admin';
  const studentPercent = school
    ? Math.min(100, Math.round((usage.student_count / school.max_students) * 100))
    : 0;
  const userPercent = school
    ? Math.min(100, Math.round((usage.user_count / school.max_users) * 100))
    : 0;

  const invoiceColumns = [
    {
      title: 'No. Invoice',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (val: string) => <span className="font-mono font-bold text-xs">{val}</span>,
    },
    {
      title: 'Paket',
      key: 'plan',
      render: (_: unknown, rec: InvoiceDTO) => {
        const planCfg = SUBSCRIPTION_PLANS[rec.plan_code] || SUBSCRIPTION_PLANS.basic;
        return (
          <span className="text-xs font-bold uppercase text-indigo-700">
            {planCfg.label} ({planCfg.durationLabel})
          </span>
        );
      },
    },
    {
      title: 'Nominal',
      dataIndex: 'amount_idr',
      key: 'amount_idr',
      render: (val: number) => (
        <span className="text-xs font-bold text-slate-800">
          {val > 0 ? formatIdr(val) : 'Kode Lisensi'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        const color =
          val === 'paid' ? 'green' : val === 'pending' ? 'gold' : 'red';
        return (
          <Tag color={color} className="uppercase font-bold text-[10px]">
            {val}
          </Tag>
        );
      },
    },
    {
      title: 'Referensi / Catatan',
      key: 'note',
      render: (_: unknown, rec: InvoiceDTO) => (
        <div className="text-xs text-slate-500">
          {rec.payment_reference && <div className="font-mono">{rec.payment_reference}</div>}
          {rec.payer_note && <div>{rec.payer_note}</div>}
          {rec.admin_note && (
            <div className="text-indigo-600 font-semibold">Admin: {rec.admin_note}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Tanggal',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => (
        <span className="text-xs text-slate-400">
          {new Date(val).toLocaleDateString('id-ID')}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Langganan & Lisensi Sekolah"
          subtitle={school ? `Status Paket Aktif • ${school.name}` : undefined}
        />

        {/* Status Paket & Kuota */}
        {school && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-slate-400">
                  Status Langganan
                </span>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={loadBilling}
                  className="rounded-xl text-xs"
                >
                  Segarkan
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900 uppercase">
                  {school.subscription_plan}
                </span>
                <Tag
                  color={school.subscription_active ? 'green' : 'red'}
                  className="font-bold uppercase text-[10px] rounded-full"
                >
                  {school.subscription_active ? school.subscription_status : 'TIDAK AKTIF'}
                </Tag>
              </div>
              <p className="text-xs text-slate-500">
                Berlaku hingga:{' '}
                <strong className="text-slate-800">
                  {new Date(school.subscription_expires_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>{' '}
                ({school.remaining_days} hari tersisa)
              </p>
              {school.subscription_active && (
                <Link
                  href="/"
                  className="inline-flex text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition"
                >
                  ← Kembali ke Dashboard Sekolah
                </Link>
              )}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
              <span className="text-xs font-extrabold uppercase text-slate-400">
                Kuota Anggota Pramuka
              </span>
              <div className="text-2xl font-black text-indigo-600">
                {usage.student_count}{' '}
                <span className="text-sm font-semibold text-slate-400">
                  / {school.max_students} siswa
                </span>
              </div>
              <Progress percent={studentPercent} strokeColor="#5b5fc7" showInfo={false} />
              <p className="text-[11px] text-slate-500">
                Terikat eksklusif untuk {school.name}.
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
              <span className="text-xs font-extrabold uppercase text-slate-400">
                Kuota Akun Pengelola
              </span>
              <div className="text-2xl font-black text-emerald-600">
                {usage.user_count}{' '}
                <span className="text-sm font-semibold text-slate-400">
                  / {school.max_users} akun
                </span>
              </div>
              <Progress percent={userPercent} strokeColor="#229e73" showInfo={false} />
              <p className="text-[11px] text-slate-500">
                Fitur AI: {school.ai_features_enabled ? '✅ Aktif' : '⛔ Nonaktif'}
              </p>
            </div>

            <div
              id="topup-ai"
              className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100 space-y-2"
            >
              <span className="text-xs font-extrabold uppercase text-indigo-500">
                ✨ Kuota & Token AI Sekolah
              </span>
              <div className="text-2xl font-black text-slate-900">
                {school.ai_total_credits ?? 0}{' '}
                <span className="text-xs font-semibold text-slate-400">
                  kuota tersedia
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Paket: {school.ai_plan_credits ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  Token Top-Up: {school.ai_topup_credits ?? 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Kuota Paket otomatis di-reset saat perpanjangan paket (Trial: {SUBSCRIPTION_PLANS.trial.aiPlanCredits}x, Basic: {SUBSCRIPTION_PLANS.basic.aiPlanCredits}x, Pro: {SUBSCRIPTION_PLANS.pro.aiPlanCredits}x). Token Top-Up tidak pernah hangus (rollover). Hubungi Admin Platform untuk pembelian Token AI tambahan.
              </p>
            </div>
          </div>
        )}

        {isAdmin ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aktivasi Kode Lisensi */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <KeyOutlined className="text-lg text-emerald-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Aktivasi Cepat via Kode Lisensi
                  </h2>
                  <p className="text-xs text-slate-400">
                    Masukkan kode lisensi / voucher resmi untuk mengaktifkan atau memperpanjang masa aktif secara instan.
                  </p>
                </div>
              </div>

              <form onSubmit={handleRedeem} className="space-y-3">
                <input
                  type="text"
                  placeholder="Contoh: SCT-A1B2-C3D4-E5F6"
                  value={licenseCode}
                  onChange={(e) => setLicenseCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={redeeming}
                  className="w-full h-11 rounded-2xl bg-emerald-600 hover:!bg-emerald-700 border-none font-bold text-xs"
                >
                  🔑 Aktifkan Kode Lisensi Sekarang
                </Button>
              </form>
            </div>

            {/* Buat Permintaan Pembayaran / Perpanjangan */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCardOutlined className="text-lg text-indigo-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Upgrade / Perpanjang Paket Sekolah
                  </h2>
                  <p className="text-xs text-slate-400">
                    Buat invoice pembayaran dan konfirmasikan referensi transfer ke pengelola platform.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateInvoice} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plans.map((p) => {
                    const isSelected = selectedPlan === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => {
                          setSelectedPlan(p.code as PaidPlanCode);
                          setBillingCycle(p.code === 'pro' ? 'yearly' : 'monthly');
                        }}
                        className={`relative text-left p-3.5 rounded-2xl border transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/30'
                            : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                        }`}
                      >
                        {p.isPopular && (
                          <span className="inline-flex self-start px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                            ⭐ Rekomendasi • Most Popular
                          </span>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-indigo-700">
                            {p.name}
                          </span>
                          {isSelected && <CheckCircleFilled className="text-indigo-600" />}
                        </div>
                        <div className="text-base font-black text-slate-900">
                          {formatIdr(p.price)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold">
                          {p.priceSubtext} • {p.durationDays} Hari
                        </div>
                        <div className="text-[10px] text-slate-600 font-bold pt-1.5 border-t border-slate-200/70">
                          {p.maxStudents} Peserta • {p.maxUsers} Admin/Pembina • {p.aiPlanCredits}x AI
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const p = plans.find((x) => x.code === selectedPlan);
                  if (!p) return null;
                  return (
                    <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-black text-indigo-700 text-sm">
                          Total Tagihan: {formatIdr(p.price)} ({p.durationLabel})
                        </div>
                        {p.isPopular && (
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold">
                            🔥 Paket Andalan
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 flex flex-col gap-1.5">
                        {p.features.map((f) => (
                          <div key={f} className="flex items-center gap-1.5 text-[11px]">
                            <CheckCircleFilled className="text-emerald-600 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <input
                  type="text"
                  placeholder="Nomor Referensi Transfer / Bukti Bayar (opsional)"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
                <input
                  type="text"
                  placeholder="Catatan tambahan (misal: Transfer BCA a.n. Bendahara Sekolah)"
                  value={payerNote}
                  onChange={(e) => setPayerNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />

                <Button
                  htmlType="submit"
                  type="primary"
                  loading={submittingInvoice}
                  className="w-full h-11 rounded-2xl bg-indigo-600 hover:!bg-indigo-700 font-bold text-xs"
                >
                  💳 Buat Invoice Pembayaran
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl text-xs font-semibold text-amber-800">
            ℹ️ Pengajuan perpanjangan paket & aktivasi kode lisensi hanya dapat dilakukan oleh akun{' '}
            <strong>Admin Sekolah</strong>.
          </div>
        )}

        {/* Riwayat Invoice Sekolah */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            🧾 Riwayat Invoice & Aktivasi ({school?.name})
          </h2>
          <Card
            className="rounded-2xl shadow-none border border-slate-100 overflow-hidden"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={invoices}
              columns={invoiceColumns}
              rowKey="id"
              pagination={{ pageSize: 8 }}
              scroll={{ x: 700 }}
              locale={{ emptyText: 'Belum ada riwayat invoice untuk sekolah ini.' }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
