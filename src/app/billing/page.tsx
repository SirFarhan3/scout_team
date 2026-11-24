'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Modal, Popconfirm, Progress, Table, Tag } from 'antd';
import {
  CheckCircleFilled,
  KeyOutlined,
  CreditCardOutlined,
  ReloadOutlined,
  PrinterOutlined,
  CloseCircleOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import { billingService } from '@/services/billingService';
import { formatIdr, PlanDefinition } from '@/lib/plans';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import {
  AI_TOPUP_PACKAGE_LIST,
  type AiTopupPackageConfig,
} from '@/lib/payment-config';
import type {
  InvoiceDTO,
  InvoiceItemType,
  SchoolDTO,
  SchoolUsageStats,
} from '@/types/school';

export default function BillingPage() {
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [usage, setUsage] = useState<SchoolUsageStats>({ student_count: 0, user_count: 0 });
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [topupPackages, setTopupPackages] = useState<AiTopupPackageConfig[]>(AI_TOPUP_PACKAGE_LIST);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // State modal konfirmasi sebelum menerbitkan invoice
  const [confirmItem, setConfirmItem] = useState<{
    itemType: InvoiceItemType;
    itemCode: string;
    title: string;
    subtitle: string;
    price: number;
    highlights: string[];
  } | null>(null);

  // Loading state saat membuat invoice baru dan redirect ke /invoice/[id]
  const [creatingCode, setCreatingCode] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Form Redeem Lisensi
  const [licenseCode, setLicenseCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

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
      if (res.data.topupPackages?.length) {
        setTopupPackages(res.data.topupPackages);
      }
      setInvoices(res.data.invoices);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal memuat informasi Pembayaran & Invoice.');
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
        if (res.data.topupPackages?.length) {
          setTopupPackages(res.data.topupPackages);
        }
        setInvoices(res.data.invoices);
      })
      .catch((err: unknown) => {
        if (mounted) {
          message.error(err instanceof Error ? err.message : 'Gagal memuat informasi Pembayaran & Invoice.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectItemAndRedirect = async (
    itemType: InvoiceItemType,
    itemCode: string
  ) => {
    try {
      setCreatingCode(itemCode);
      const invoice = await billingService.createPendingInvoice({
        itemType,
        itemCode,
      });
      message.loading('Membuka dokumen tagihan pembayaran...', 1.5);
      window.location.href = `/invoice/${encodeURIComponent(invoice.id)}`;
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal membuat tagihan invoice.');
      setCreatingCode(null);
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    try {
      setCancellingId(invoiceId);
      const res = await billingService.cancelInvoice(invoiceId);
      message.success(res.message || 'Invoice berhasil dibatalkan.');
      await loadBilling();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal membatalkan invoice.');
    } finally {
      setCancellingId(null);
    }
  };

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

  if (loading) {
    return <PageLoader text="Memuat Pembayaran & Invoice..." />;
  }

  const isAdmin = currentUser?.role === 'admin';
  const studentPercent = school
    ? Math.min(100, Math.round((usage.student_count / school.max_students) * 100))
    : 0;
  const userPercent = school
    ? Math.min(100, Math.round((usage.user_count / school.max_users) * 100))
    : 0;
  const planAiMax = school
    ? SUBSCRIPTION_PLANS[school.subscription_plan]?.aiPlanCredits || 2
    : 2;
  const aiPlanPercent = school
    ? Math.min(100, Math.round(((school.ai_plan_credits ?? 0) / planAiMax) * 100))
    : 0;

  const invoiceColumns = [
    {
      title: 'No. Invoice',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (val: string, rec: InvoiceDTO) => (
        <Link
          href={`/invoice/${encodeURIComponent(rec.id)}`}
          className="font-mono font-bold text-xs text-indigo-600 hover:underline"
        >
          {val}
        </Link>
      ),
    },
    {
      title: 'Item Tagihan',
      key: 'item',
      render: (_: unknown, rec: InvoiceDTO) => (
        <div>
          <div className="text-xs font-bold text-slate-900">{rec.item_name}</div>
          <div className="text-[11px] text-slate-400">
            {rec.item_type === 'topup' ? '🪙 Top-Up Token AI' : '🏫 Paket Langganan Sekolah'}
          </div>
        </div>
      ),
    },
    {
      title: 'Total Nominal',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (val: number) => (
        <span className="text-xs font-black text-slate-900">
          {val > 0 ? formatIdr(val) : 'Rp 0 (Lisensi)'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        const color = val === 'paid' ? 'green' : val === 'pending' ? 'gold' : 'default';
        const label =
          val === 'paid' ? 'LUNAS' : val === 'pending' ? 'PENDING' : 'DIBATALKAN';
        return (
          <Tag color={color} className="uppercase font-bold text-[10px]">
            {label}
          </Tag>
        );
      },
    },
    {
      title: 'Tanggal',
      key: 'date',
      render: (_: unknown, rec: InvoiceDTO) => (
        <div className="text-xs text-slate-500">
          <div>{new Date(rec.created_at).toLocaleDateString('id-ID')}</div>
          {rec.paid_at && (
            <div className="text-[10px] text-emerald-600 font-semibold">
              Lunas: {new Date(rec.paid_at).toLocaleDateString('id-ID')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: unknown, rec: InvoiceDTO) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {rec.status === 'pending' && (
            <>
              <Link href={`/invoice/${encodeURIComponent(rec.id)}`}>
                <Button
                  size="small"
                  type="primary"
                  icon={<CreditCardOutlined />}
                  className="bg-indigo-600 hover:!bg-indigo-700 rounded-xl text-xs font-bold"
                >
                  Bayar Sekarang
                </Button>
              </Link>
              {isAdmin && (
                <Popconfirm
                  title="Batalkan tagihan ini?"
                  description="Tagihan yang dibatalkan tidak dapat diaktifkan kembali."
                  okText="Ya, Batalkan"
                  cancelText="Tidak"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleCancelInvoice(rec.id)}
                >
                  <Button
                    size="small"
                    danger
                    loading={cancellingId === rec.id}
                    icon={<CloseCircleOutlined />}
                    className="rounded-xl text-xs"
                  >
                    Batalkan
                  </Button>
                </Popconfirm>
              )}
            </>
          )}
          {rec.status === 'paid' && (
            <Link href={`/invoice/${encodeURIComponent(rec.id)}`}>
              <Button
                size="small"
                icon={<PrinterOutlined />}
                className="border-emerald-300 text-emerald-700 bg-emerald-50 hover:!bg-emerald-100 rounded-xl text-xs font-bold"
              >
                Cetak PDF
              </Button>
            </Link>
          )}
          {rec.status === 'cancelled' && (
            <Link href={`/invoice/${encodeURIComponent(rec.id)}`}>
              <Button size="small" className="rounded-xl text-xs text-slate-500">
                Lihat Detail
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Pembayaran & Invoice"
          subtitle={school ? `Kelola Paket Langganan, Token AI & Kwitansi Resmi • ${school.name}` : undefined}
        />

        {/* 1. Ringkasan Paket Aktif & Usage Bar */}
        {school && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-slate-400">
                  Paket Aktif Sekolah
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
                  ← Kembali ke Dashboard
                </Link>
              )}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
              <span className="text-xs font-extrabold uppercase text-slate-400">
                Usage Peserta Pramuka
              </span>
              <div className="text-2xl font-black text-indigo-600">
                {usage.student_count}{' '}
                <span className="text-sm font-semibold text-slate-400">
                  / {school.max_students} peserta
                </span>
              </div>
              <Progress
                percent={studentPercent}
                strokeColor={studentPercent >= 90 ? '#e11d48' : '#4f46e5'}
                showInfo={false}
              />
              <p className="text-[11px] text-slate-500">
                Terpakai {studentPercent}% dari kuota paket {school.subscription_plan.toUpperCase()}.
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
              <span className="text-xs font-extrabold uppercase text-slate-400">
                Usage Admin & Pembina
              </span>
              <div className="text-2xl font-black text-emerald-600">
                {usage.user_count}{' '}
                <span className="text-sm font-semibold text-slate-400">
                  / {school.max_users} akun
                </span>
              </div>
              <Progress percent={userPercent} strokeColor="#10b981" showInfo={false} />
              <p className="text-[11px] text-slate-500">
                Terpakai {userPercent}% dari batas maksimal akun pengelola.
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100 space-y-2">
              <span className="text-xs font-extrabold uppercase text-indigo-500">
                ✨ Sisa Kuota & Token AI
              </span>
              <div className="text-2xl font-black text-slate-900">
                {school.ai_total_credits ?? 0}{' '}
                <span className="text-xs font-semibold text-slate-400">
                  generate tersedia
                </span>
              </div>
              <Progress percent={aiPlanPercent} strokeColor="#6366f1" showInfo={false} />
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Kuota Paket: {school.ai_plan_credits ?? 0}/{planAiMax}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  Token Top-Up: {school.ai_topup_credits ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {isAdmin ? (
          <>
            {/* 2. Pilihan Paket Langganan Sekolah (Basic & Pro) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    🏫 Pilih Paket Langganan Sekolah
                  </h2>
                  <p className="text-xs text-slate-500">
                    Klik <strong>Pilih Paket</strong> untuk menerbitkan dokumen tagihan resmi (QRIS / Transfer Bank) dan konfirmasi via WhatsApp.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 self-start sm:self-auto">
                  ⚡ Aktif Instan Setelah Konfirmasi
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((p) => (
                  <div
                    key={p.code}
                    className={`rounded-3xl p-6 border-2 transition flex flex-col justify-between gap-4 ${
                      p.isPopular
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black uppercase text-indigo-700">
                          {p.name}
                        </span>
                        {p.isPopular && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                            ⭐ Paket Andalan • Most Popular
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-2xl font-black text-slate-900">
                          {formatIdr(p.price)}
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          {p.priceSubtext} • Masa aktif {p.durationDays} hari
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                        {p.features.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-slate-700">
                            <CheckCircleFilled className="text-emerald-600 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="primary"
                      loading={creatingCode === p.code}
                      onClick={() =>
                        setConfirmItem({
                          itemType: 'subscription',
                          itemCode: p.code,
                          title: `Langganan ${p.name}`,
                          subtitle: `${p.priceSubtext} • Masa aktif ${p.durationDays} hari`,
                          price: p.price,
                          highlights: p.features,
                        })
                      }
                      className={`w-full h-11 rounded-2xl font-bold text-xs border-none ${
                        p.isPopular
                          ? 'bg-indigo-600 hover:!bg-indigo-700'
                          : 'bg-slate-800 hover:!bg-slate-900'
                      }`}
                    >
                      💳 Pilih {p.name} — {formatIdr(p.price)}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Top-Up Token AI & Aktivasi Kode Lisensi */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div
                id="topup-ai"
                className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                      <ThunderboltFilled className="text-amber-500" /> Top-Up Token AI Sekolah (Rollover)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Kuota paket habis tapi masa langganan masih aktif? Beli Token AI tambahan yang <strong>tidak pernah hangus</strong> saat ganti periode paket.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {topupPackages.map((pkg) => (
                    <div
                      key={pkg.code}
                      className={`rounded-2xl p-4 border-2 transition flex flex-col justify-between gap-3 ${
                        pkg.isPopular
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        {pkg.isPopular && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400 text-slate-950 mb-1">
                            🔥 Paling Hemat
                          </span>
                        )}
                        <div className="text-sm font-black text-slate-900">
                          🪙 +{pkg.tokens} Token AI
                        </div>
                        <div className="text-lg font-black text-indigo-600">
                          {formatIdr(pkg.price)}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {pkg.description}
                        </p>
                      </div>

                      <Button
                        type="primary"
                        loading={creatingCode === pkg.code}
                        onClick={() =>
                          setConfirmItem({
                            itemType: 'topup',
                            itemCode: pkg.code,
                            title: pkg.name,
                            subtitle: pkg.description,
                            price: pkg.price,
                            highlights: [
                              `Penambahan +${pkg.tokens} Token Generate AI untuk ${school?.name || 'sekolah Anda'}`,
                              'Saldo Token bersifat rollover (tidak pernah hangus saat ganti/perpanjang paket)',
                              'Dapat digunakan bersama oleh seluruh pembina di sekolah',
                            ],
                          })
                        }
                        className="w-full h-10 rounded-xl bg-amber-500 hover:!bg-amber-600 text-slate-950 font-black text-xs border-none"
                      >
                        Beli {pkg.tokens} Token
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aktivasi Kode Voucher & Lisensi */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <KeyOutlined className="text-lg text-emerald-600" />
                    <h2 className="text-base font-black text-slate-900">
                      🎟️ Klaim Kode Voucher / Lisensi
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Masukkan kode voucher dari Superadmin untuk menambah <strong>Token Generate AI</strong>, menambah <strong>Masa Aktif Sekolah</strong>, atau mengaktifkan <strong>Paket Langganan</strong> secara instan.
                  </p>
                </div>

                <form onSubmit={handleRedeem} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Contoh: VAI-A1B2-C3D4 / VEX-... / SCT-..."
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
                    🎟️ Klaim Kode Voucher / Lisensi
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl text-xs font-semibold text-amber-800">
            ℹ️ Pemilihan paket langganan, pembelian Token AI, dan aktivasi kode lisensi hanya dapat dilakukan oleh akun{' '}
            <strong>Admin Sekolah</strong>.
          </div>
        )}

        {/* 4. Tabel Riwayat Invoice & Kwitansi Sekolah */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900">
                🧾 Riwayat Tagihan & Kwitansi Pembayaran ({school?.name})
              </h2>
              <p className="text-xs text-slate-500">
                Klik <strong>Bayar Sekarang</strong> pada invoice <em>Pending</em> untuk melihat QRIS/Rekening, atau klik <strong>Cetak PDF</strong> pada invoice <em>Lunas</em> untuk mengunduh kwitansi resmi.
              </p>
            </div>
          </div>

          <Card
            className="rounded-2xl shadow-none border border-slate-100 overflow-hidden"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={invoices}
              columns={invoiceColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 750 }}
              locale={{ emptyText: 'Belum ada riwayat invoice atau pembelian untuk sekolah ini.' }}
            />
          </Card>
        </div>

        {/* Modal Konfirmasi Pesanan Sebelum Menerbitkan Invoice */}
        <Modal
          open={!!confirmItem}
          onCancel={() => {
            if (!creatingCode) setConfirmItem(null);
          }}
          footer={null}
          title="🧾 Konfirmasi Pesanan & Pembuatan Tagihan"
          centered
        >
          {confirmItem && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-slate-400">
                      Item yang Dipilih
                    </div>
                    <div className="text-sm font-black text-slate-900">
                      {confirmItem.title}
                    </div>
                    <div className="text-xs text-slate-500">{confirmItem.subtitle}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-extrabold uppercase text-slate-400">
                      Total Tagihan
                    </div>
                    <div className="text-lg font-black text-indigo-600">
                      {formatIdr(confirmItem.price)}
                    </div>
                  </div>
                </div>

                {school && (
                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>Sekolah Penerima:</span>
                    <strong className="text-slate-900">{school.name}</strong>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 px-1">
                <div className="text-[11px] font-bold uppercase text-slate-400">
                  Rincian Benefit:
                </div>
                {confirmItem.highlights.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircleFilled className="text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-[11px] text-indigo-800 leading-relaxed">
                ℹ️ Setelah Anda menekan <strong>Ya, Buat Tagihan</strong>, sistem akan menerbitkan dokumen Invoice resmi (status <em>Pending</em>) beserta instruksi Transfer Bank / QRIS dan tombol konfirmasi WhatsApp.
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  disabled={!!creatingCode}
                  onClick={() => setConfirmItem(null)}
                  className="rounded-xl text-xs font-bold h-10"
                >
                  Batal
                </Button>
                <Button
                  type="primary"
                  loading={creatingCode === confirmItem.itemCode}
                  onClick={() =>
                    handleSelectItemAndRedirect(confirmItem.itemType, confirmItem.itemCode)
                  }
                  className="bg-indigo-600 hover:!bg-indigo-700 border-none rounded-xl text-xs font-bold h-10"
                >
                  ✅ Ya, Buat Tagihan & Lanjut Bayar
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
