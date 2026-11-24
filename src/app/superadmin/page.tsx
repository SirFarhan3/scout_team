'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Modal, Popconfirm, Table, Tag } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  KeyOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import PasswordInput from '@/components/PasswordInput';
import { authService } from '@/lib/auth';
import { superadminService, SuperadminSchoolItem } from '@/services/superadminService';
import { formatIdr } from '@/lib/plans';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import type {
  InvoiceDTO,
  LicenseKeyDTO,
  PaidPlanCode,
  SubscriptionPlanCode,
  SubscriptionStatus,
  VoucherType,
} from '@/types/school';

export default function SuperadminPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SuperadminSchoolItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKeyDTO[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'schools' | 'invoices' | 'keys' | 'audit'>('schools');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');

  // Helper agar input angka default '0', bisa dihapus sampai kosong (''), dan tidak pernah jadi '010'
  const cleanNumberInput = (raw: string): string => {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly === '') return '';
    return digitsOnly.replace(/^0+(?=\d)/, '');
  };

  // Modal Tambah Sekolah Manual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [city, setCity] = useState('');
  const [gugusdepan, setGugusdepan] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [plan, setPlan] = useState<SubscriptionPlanCode>('pro');
  const [durationDays, setDurationDays] = useState<string>(
    String(SUBSCRIPTION_PLANS.pro.durationDays)
  );
  const [creatingSchool, setCreatingSchool] = useState(false);

  // Modal Kelola Langganan & Edit Sekolah
  const [editingSchool, setEditingSchool] = useState<SuperadminSchoolItem | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editAdminFullName, setEditAdminFullName] = useState('');
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editPlan, setEditPlan] = useState<SubscriptionPlanCode>('pro');
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>('active');
  const [extendDays, setExtendDays] = useState<string>('0');
  const [topupAiCredits, setTopupAiCredits] = useState<string>('0');
  const [savingSchool, setSavingSchool] = useState(false);

  // Form Generate Kode Voucher & Lisensi
  const [voucherType, setVoucherType] = useState<VoucherType>('ai_tokens');
  const [keyPlan, setKeyPlan] = useState<PaidPlanCode>('pro');
  const [keyDays, setKeyDays] = useState<string>('0');
  const [keyAiTokens, setKeyAiTokens] = useState<string>('0');
  const [keyMaxUses, setKeyMaxUses] = useState<string>('1');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [latestGeneratedCode, setLatestGeneratedCode] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [previewVoucher, setPreviewVoucher] = useState<LicenseKeyDTO | null>(null);

  const fetchSuperadminData = async () => {
    const user = await authService.getCurrentUser();
    if (!user) {
      window.location.href = '/login';
      return null;
    }
    if (user.role !== 'superadmin') {
      window.location.href = '/';
      return null;
    }
    return superadminService.getOverview();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchSuperadminData();
      if (!data) return;
      setSchools(data.schools);
      setInvoices(data.invoices);
      setLicenseKeys(data.licenseKeys);
      setAuditLogs(data.auditLogs);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal memuat data Superadmin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchSuperadminData()
      .then((data) => {
        if (!mounted || !data) return;
        setSchools(data.schools);
        setInvoices(data.invoices);
        setLicenseKeys(data.licenseKeys);
        setAuditLogs(data.auditLogs);
      })
      .catch((err: unknown) => {
        if (mounted) {
          message.error(err instanceof Error ? err.message : 'Gagal memuat data Superadmin.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDays = Number(durationDays);
    if (!durationDays.trim() || Number.isNaN(parsedDays) || parsedDays <= 0) {
      message.warning('Masa aktif (hari) wajib diisi dan tidak boleh 0.');
      return;
    }
    try {
      setCreatingSchool(true);
      await superadminService.createSchool({
        schoolName,
        city,
        gugusdepan,
        adminFullName,
        adminUsername,
        adminPassword,
        plan,
        durationDays: parsedDays,
      });
      message.success('Sekolah dan akun admin pertamanya berhasil dibuat!');
      setShowCreateModal(false);
      setSchoolName('');
      setCity('');
      setGugusdepan('');
      setAdminFullName('');
      setAdminUsername('');
      setAdminPassword('');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal membuat sekolah.');
    } finally {
      setCreatingSchool(false);
    }
  };

  const handleSaveSchoolSub = async () => {
    if (!editingSchool) return;
    const parsedExtendDays = Number(extendDays) || 0;
    const parsedTopupCredits = Number(topupAiCredits) || 0;
    try {
      setSavingSchool(true);
      await superadminService.updateSchool(editingSchool.id, {
        name: editSchoolName,
        adminFullName: editAdminFullName,
        ...(editAdminUsername.trim() ? { adminUsername: editAdminUsername.trim() } : {}),
        ...(editAdminPassword.trim() ? { adminPassword: editAdminPassword.trim() } : {}),
        subscription_plan: editPlan,
        subscription_status: editStatus,
        ...(parsedExtendDays > 0 ? { extendDays: parsedExtendDays } : {}),
        ...(parsedTopupCredits > 0 ? { topupAiCredits: parsedTopupCredits } : {}),
      });
      message.success('Data sekolah, admin, dan langganan berhasil diperbarui!');
      setEditingSchool(null);
      setEditAdminPassword('');
      setExtendDays('0');
      setTopupAiCredits('0');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memperbarui sekolah.');
    } finally {
      setSavingSchool(false);
    }
  };

  const handleProcessInvoice = async (id: string, action: 'mark_paid' | 'cancel') => {
    try {
      await superadminService.processInvoice(id, action);
      message.success(
        action === 'mark_paid'
          ? 'Invoice dikonfirmasi LUNAS! Paket sekolah / Token AI otomatis diaktifkan.'
          : 'Invoice berhasil dibatalkan.'
      );
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memproses invoice.');
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDays = Number(keyDays);
    const parsedAiTokens = Number(keyAiTokens);
    const parsedMaxUses = Number(keyMaxUses);

    if (!keyMaxUses.trim() || Number.isNaN(parsedMaxUses) || parsedMaxUses <= 0) {
      message.warning('Maksimal pemakaian wajib diisi dan tidak boleh 0.');
      return;
    }

    if (voucherType === 'ai_tokens') {
      if (!keyAiTokens.trim() || Number.isNaN(parsedAiTokens) || parsedAiTokens <= 0) {
        message.warning('Jumlah Token Generate AI wajib diisi dan tidak boleh 0.');
        return;
      }
    } else if (voucherType === 'extend_days') {
      if (!keyDays.trim() || Number.isNaN(parsedDays) || parsedDays <= 0) {
        message.warning('Tambahan masa aktif (hari) wajib diisi dan tidak boleh 0.');
        return;
      }
    } else {
      if (!keyDays.trim() || Number.isNaN(parsedDays) || parsedDays <= 0) {
        message.warning('Masa aktif paket (hari) wajib diisi dan tidak boleh 0.');
        return;
      }
    }

    try {
      setGeneratingKey(true);
      const res = await superadminService.generateLicenseKey({
        voucherType,
        planCode: keyPlan,
        durationDays: parsedDays > 0 ? parsedDays : 1,
        aiTokens: parsedAiTokens > 0 ? parsedAiTokens : 0,
        maxUses: parsedMaxUses,
      });
      setLatestGeneratedCode(res.plainCode);
      message.success('Kode voucher / lisensi berhasil dibuat!');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal membuat kode voucher / lisensi.');
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await superadminService.revokeLicenseKey(id);
      message.success('Kode lisensi dinonaktifkan.');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal menonaktifkan lisensi.');
    }
  };

  const handleDeleteSchool = async (school: SuperadminSchoolItem) => {
    try {
      const res = await superadminService.deleteSchool(school.id);
      message.success(res.message || `Sekolah "${school.name}" berhasil dihapus.`);
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus sekolah.');
    }
  };

  const handlePlanChange = (selectedPlan: SubscriptionPlanCode) => {
    setPlan(selectedPlan);
    setDurationDays(String(SUBSCRIPTION_PLANS[selectedPlan].durationDays));
  };

  const handleEditPlanChange = (selectedPlan: SubscriptionPlanCode) => {
    setEditPlan(selectedPlan);
    setExtendDays(String(SUBSCRIPTION_PLANS[selectedPlan].durationDays));
    if (selectedPlan === 'trial') {
      setEditStatus('trial');
    } else if (editStatus === 'trial' || editStatus === 'pending' || editStatus === 'expired') {
      setEditStatus('active');
    }
  };

  const handleKeyPlanChange = (selectedPlan: PaidPlanCode) => {
    setKeyPlan(selectedPlan);
    setKeyDays(String(SUBSCRIPTION_PLANS[selectedPlan].durationDays));
  };

  const pendingInvoicesCount = invoices.filter((i) => i.status === 'pending').length;
  const activeSchoolsCount = schools.filter((s) => s.subscription_active).length;

  const schoolColumns = [
    {
      title: 'Sekolah',
      key: 'name',
      render: (_: any, rec: SuperadminSchoolItem) => (
        <div>
          <div className="font-bold text-slate-900 text-xs sm:text-sm">{rec.name}</div>
          <div className="text-[11px] text-slate-400">
            {rec.city} • {rec.gugusdepan || rec.slug}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Admin: <span className="font-semibold text-slate-700">{rec.admin_full_name || rec.contact_name || '-'}</span>{' '}
            {rec.admin_username && (
              <span className="font-mono text-indigo-600">(@{rec.admin_username})</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Paket',
      dataIndex: 'subscription_plan',
      key: 'subscription_plan',
      render: (val: string) => (
        <Tag color="geekblue" className="uppercase font-bold text-[10px]">
          {val}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, rec: SuperadminSchoolItem) => (
        <Tag
          color={rec.subscription_active ? 'green' : 'red'}
          className="uppercase font-bold text-[10px]"
        >
          {rec.subscription_active ? `${rec.subscription_status} (${rec.remaining_days}h)` : rec.subscription_status}
        </Tag>
      ),
    },
    {
      title: 'Penggunaan',
      key: 'usage',
      render: (_: any, rec: SuperadminSchoolItem) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div>
            Siswa: <strong>{rec.student_count}</strong>/{rec.max_students}
          </div>
          <div>
            Akun: <strong>{rec.user_count}</strong>/{rec.max_users}
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold">
            AI: <strong>{rec.ai_total_credits ?? 0}</strong> (Paket: {rec.ai_plan_credits ?? 0} | Token: {rec.ai_topup_credits ?? 0})
          </div>
        </div>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: any, rec: SuperadminSchoolItem) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setEditingSchool(rec);
              setEditSchoolName(rec.name || '');
              setEditAdminFullName(rec.admin_full_name || rec.contact_name || '');
              setEditAdminUsername(rec.admin_username || '');
              setEditAdminPassword('');
              setEditPlan(rec.subscription_plan);
              setEditStatus(rec.subscription_status);
              setExtendDays('0');
              setTopupAiCredits('0');
            }}
            className="bg-indigo-600 rounded-xl text-xs font-bold"
          >
            Edit / Paket
          </Button>
          <Popconfirm
            title={`Hapus sekolah "${rec.name}"?`}
            description="Sekolah akan di-soft delete dan seluruh akun di dalamnya dinonaktifkan."
            okText="Ya, Hapus"
            okButtonProps={{ danger: true }}
            cancelText="Batal"
            onConfirm={() => handleDeleteSchool(rec)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="rounded-xl text-xs font-bold"
            >
              Hapus
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const filteredInvoices =
    invoiceFilter === 'all'
      ? invoices
      : invoices.filter((inv) => inv.status === invoiceFilter);

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
      title: 'Sekolah',
      key: 'school_name',
      render: (_: any, rec: InvoiceDTO) => (
        <div>
          <div className="font-bold text-xs text-slate-900">{rec.school_name}</div>
          {rec.gugusdepan && (
            <div className="text-[11px] text-slate-400">{rec.gugusdepan}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Item & Kategori',
      key: 'item',
      render: (_: any, rec: InvoiceDTO) => (
        <div className="text-xs">
          <div className="font-bold text-slate-800">{rec.item_name}</div>
          <div className="text-[11px] text-slate-500">
            {rec.item_type === 'topup' ? '🪙 Top-Up Token AI' : '🏫 Paket Langganan'}
          </div>
        </div>
      ),
    },
    {
      title: 'Total Tagihan',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (val: number) => (
        <span className="text-xs font-black text-indigo-700">
          {val > 0 ? formatIdr(val) : 'Rp 0 (Lisensi)'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <Tag
          color={val === 'paid' ? 'green' : val === 'pending' ? 'gold' : 'default'}
          className="uppercase font-bold text-[10px]"
        >
          {val === 'paid' ? 'LUNAS' : val === 'pending' ? 'PENDING' : 'DIBATALKAN'}
        </Tag>
      ),
    },
    {
      title: 'Tanggal',
      key: 'date',
      render: (_: any, rec: InvoiceDTO) => (
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
      render: (_: any, rec: InvoiceDTO) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {rec.status === 'pending' && (
            <>
              <Popconfirm
                title="Konfirmasi pelunasan invoice ini?"
                description="Paket langganan atau Token AI sekolah akan langsung aktif."
                okText="Ya, Konfirmasi Lunas"
                cancelText="Batal"
                onConfirm={() => handleProcessInvoice(rec.id, 'mark_paid')}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  className="bg-emerald-600 hover:!bg-emerald-700 border-none rounded-lg text-xs font-bold"
                >
                  Konfirmasi Lunas
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Batalkan invoice ini?"
                okText="Ya, Batalkan"
                cancelText="Tidak"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleProcessInvoice(rec.id, 'cancel')}
              >
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  className="rounded-lg text-xs"
                >
                  Batalkan
                </Button>
              </Popconfirm>
            </>
          )}
          <Link href={`/invoice/${encodeURIComponent(rec.id)}`}>
            <Button size="small" className="rounded-lg text-xs font-semibold">
              {rec.status === 'paid' ? '🖨️ Kwitansi PDF' : '📄 Lihat Detail'}
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  const keyColumns = [
    {
      title: 'Kode Voucher / Lisensi',
      dataIndex: 'code_preview',
      key: 'code_preview',
      render: (val: string, rec: LicenseKeyDTO) => {
        const isRevealed = Boolean(revealedKeyIds[rec.id]);
        const displayCode = isRevealed
          ? val
          : `${val.slice(0, 4)}****${val.slice(-4)}`;

        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-xs">{displayCode}</span>
            
          </div>
        );
      },
    },
    {
      title: 'Jenis Voucher',
      key: 'voucher_type',
      render: (_: any, rec: LicenseKeyDTO) => {
        if (rec.voucher_type === 'ai_tokens') {
          return (
            <Tag color="gold" className="uppercase text-[10px] font-bold">
              🪙 Token Generate AI
            </Tag>
          );
        }
        if (rec.voucher_type === 'extend_days') {
          return (
            <Tag color="cyan" className="uppercase text-[10px] font-bold">
              ⏳ Tambah Masa Aktif
            </Tag>
          );
        }
        return (
          <Tag color="geekblue" className="uppercase text-[10px] font-bold">
            🏫 Lisensi Paket {rec.plan_code}
          </Tag>
        );
      },
    },
    {
      title: 'Isi / Benefit Voucher',
      key: 'benefit',
      render: (_: any, rec: LicenseKeyDTO) => {
        if (rec.voucher_type === 'ai_tokens') {
          return (
            <span className="text-xs font-black text-amber-700">
              +{rec.ai_tokens} Token AI (Rollover)
            </span>
          );
        }
        if (rec.voucher_type === 'extend_days') {
          return (
            <span className="text-xs font-bold text-slate-800">
              +{rec.duration_days} Hari Masa Aktif
              {rec.ai_tokens > 0 ? ` • +${rec.ai_tokens} Token AI` : ''}
            </span>
          );
        }
        return (
          <span className="text-xs font-bold text-indigo-700">
            Paket {rec.plan_code.toUpperCase()} ({rec.duration_days} Hari)
            {rec.ai_tokens > 0 ? ` • +${rec.ai_tokens} Token AI` : ''}
          </span>
        );
      },
    },
    {
      title: 'Pemakaian',
      key: 'uses',
      render: (_: any, rec: LicenseKeyDTO) => (
        <span className="text-xs font-mono">
          {rec.used_count} / {rec.max_uses}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'default'} className="text-[10px] font-bold uppercase">
          {val ? 'Tersedia' : 'Terpakai/Nonaktif'}
        </Tag>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: any, rec: LicenseKeyDTO) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreviewVoucher(rec)}
            className="rounded-lg text-xs font-semibold"
          >
            Preview
          </Button>
          {rec.is_active && (
            <Popconfirm
              title="Nonaktifkan kode voucher/lisensi ini?"
              onConfirm={() => handleRevokeKey(rec.id)}
            >
              <Button size="small" danger className="rounded-lg text-xs">
                Cabut
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageLoader text="Memuat Panel Superadmin..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Panel Superadmin Platform"
          subtitle="Kelola Sekolah Berbayar, Verifikasi Pembayaran, & Generator Lisensi (Terisolasi dari Data Siswa)"
        />

        {/* KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase">Total Sekolah</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{schools.length}</div>
          </div>
          <div className="bg-emerald-50/70 p-5 rounded-3xl border border-emerald-200/70 shadow-sm">
            <div className="text-xs font-bold text-emerald-700 uppercase">Sekolah Aktif / Trial</div>
            <div className="text-3xl font-black text-emerald-600 mt-1">{activeSchoolsCount}</div>
          </div>
          <div className="bg-amber-50/70 p-5 rounded-3xl border border-amber-200/70 shadow-sm">
            <div className="text-xs font-bold text-amber-700 uppercase">Invoice Menunggu</div>
            <div className="text-3xl font-black text-amber-600 mt-1">{pendingInvoicesCount}</div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between gap-3">
          <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('schools')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'schools' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              🏫 Sekolah ({schools.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'invoices' ? 'bg-amber-500 text-white' : 'text-slate-600'
              }`}
            >
              💳 Invoice ({pendingInvoicesCount} Pending)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('keys')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'keys' ? 'bg-emerald-600 text-white' : 'text-slate-600'
              }`}
            >
              🎟️ Voucher & Lisensi ({licenseKeys.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'audit' ? 'bg-slate-800 text-white' : 'text-slate-600'
              }`}
            >
              🛡️ Audit Log ({auditLogs.length})
            </button>
          </div>

          <div className="flex gap-2">
            <Button icon={<ReloadOutlined spin={loading} />} onClick={loadData} className="rounded-xl h-10 text-xs font-bold">
              Segarkan
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 rounded-xl h-10 text-xs font-bold"
            >
              Tambah Sekolah
            </Button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'schools' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <Card className="rounded-2xl shadow-none border border-slate-100 overflow-hidden" styles={{ body: { padding: 0 } }}>
              <Table dataSource={schools} columns={schoolColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 750 }} />
            </Card>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  💳 Daftar Invoice & Konfirmasi Pelunasan
                </h2>
                <p className="text-xs text-slate-500">
                  Klik <strong>Konfirmasi Lunas</strong> untuk mengaktifkan paket sekolah atau menambah Token AI dalam 1 klik.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                {(
                  [
                    { key: 'all', label: `Semua (${invoices.length})` },
                    { key: 'pending', label: `Pending (${pendingInvoicesCount})` },
                    {
                      key: 'paid',
                      label: `Lunas (${invoices.filter((i) => i.status === 'paid').length})`,
                    },
                    {
                      key: 'cancelled',
                      label: `Dibatalkan (${invoices.filter((i) => i.status === 'cancelled').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setInvoiceFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      invoiceFilter === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <Card className="rounded-2xl shadow-none border border-slate-100 overflow-hidden" styles={{ body: { padding: 0 } }}>
              <Table dataSource={filteredInvoices} columns={invoiceColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 850 }} />
            </Card>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <KeyOutlined className="text-emerald-600" /> Buat Kode Voucher / Lisensi Baru
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kode yang di-generate dapat dimasukkan sekolah di menu <strong>Pembayaran & Invoice → Klaim Kode Voucher / Lisensi</strong>.
                  </p>
                </div>
              </div>

              {/* Pilihan Jenis Voucher */}
              <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setVoucherType('ai_tokens');
                    setKeyAiTokens('0');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    voucherType === 'ai_tokens'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  🪙 Voucher Token Generate AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoucherType('extend_days');
                    setKeyDays('0');
                    setKeyAiTokens('0');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    voucherType === 'extend_days'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  ⏳ Voucher Tambahan Masa Aktif
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoucherType('plan');
                    setKeyDays(String(SUBSCRIPTION_PLANS[keyPlan].durationDays));
                    setKeyAiTokens('0');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    voucherType === 'plan'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  🏫 Lisensi Paket Langganan (Basic / Pro)
                </button>
              </div>

              <form onSubmit={handleGenerateKey} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                {voucherType === 'ai_tokens' && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-[10px] font-bold text-amber-700 uppercase">
                      🪙 Jumlah Token Generate AI (+Token) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={keyAiTokens}
                        onChange={(e) => setKeyAiTokens(cleanNumberInput(e.target.value))}
                        className="w-full bg-amber-50/60 border border-amber-300 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900"
                      />
                      <div className="flex gap-1 shrink-0">
                        {[5, 10, 25, 50].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setKeyAiTokens(String(num))}
                            className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              keyAiTokens === String(num)
                                ? 'bg-amber-500 text-slate-950 border-amber-500'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            +{num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {voucherType === 'extend_days' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-cyan-700 uppercase mb-1">
                        ⏳ Tambah Masa Aktif (+Hari) *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={keyDays}
                        onChange={(e) => setKeyDays(cleanNumberInput(e.target.value))}
                        className="w-full bg-cyan-50/50 border border-cyan-300 rounded-xl px-3 py-2.5 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Bonus Token AI (Opsional, 0 jika tanpa)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={keyAiTokens}
                        onChange={(e) => setKeyAiTokens(cleanNumberInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                      />
                    </div>
                  </>
                )}

                {voucherType === 'plan' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Paket Langganan</label>
                      <select
                        value={keyPlan}
                        onChange={(e) => handleKeyPlanChange(e.target.value as PaidPlanCode)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                      >
                        <option value="basic">
                          Basic — {formatIdr(SUBSCRIPTION_PLANS.basic.price)} ({SUBSCRIPTION_PLANS.basic.durationDays} Hari)
                        </option>
                        <option value="pro">
                          Pro (Most Popular) — {formatIdr(SUBSCRIPTION_PLANS.pro.price)} ({SUBSCRIPTION_PLANS.pro.durationDays} Hari)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Masa Aktif (Hari) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={keyDays}
                        onChange={(e) => setKeyDays(cleanNumberInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Maks Pemakaian *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1"
                    value={keyMaxUses}
                    onChange={(e) => setKeyMaxUses(cleanNumberInput(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                  />
                </div>
                <Button htmlType="submit" type="primary" loading={generatingKey} className="bg-emerald-600 border-none h-10 rounded-xl font-bold text-xs">
                  Generate Kode Voucher
                </Button>
              </form>

              {latestGeneratedCode && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-700 uppercase">
                      Salin Kode Voucher / Lisensi Sekarang (Hanya Ditampilkan Sekali):
                    </div>
                    <div className="text-lg font-mono font-black text-emerald-900">
                      {latestGeneratedCode}
                    </div>
                  </div>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(latestGeneratedCode);
                      message.success('Kode voucher berhasil disalin!');
                    }}
                  >
                    Salin Kode
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <Card className="rounded-2xl shadow-none border border-slate-100 overflow-hidden" styles={{ body: { padding: 0 } }}>
                <Table dataSource={licenseKeys} columns={keyColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 650 }} />
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap justify-between gap-2 text-xs bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/70">
                <div>
                  <span className="font-mono font-bold text-indigo-700">{log.action}</span>{' '}
                  <span className="text-slate-500">• IP: {log.ip_address || '-'}</span>
                </div>
                <span className="text-slate-400 font-mono">
                  {new Date(log.created_at).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Modal Tambah Sekolah */}
        <Modal
          open={showCreateModal}
          onCancel={() => setShowCreateModal(false)}
          footer={null}
          title="🏫 Tambah Sekolah & Admin"
          centered
        >
          <form onSubmit={handleCreateSchool} className="space-y-3 pt-2">
            <input
              type="text"
              placeholder="Nama Sekolah *"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Kota/Kabupaten *"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                required
              />
              <input
                type="text"
                placeholder="Gugusdepan (opsional)"
                value={gugusdepan}
                onChange={(e) => setGugusdepan(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={plan}
                onChange={(e) => handlePlanChange(e.target.value as SubscriptionPlanCode)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="trial">Trial (7 Hari)</option>
                <option value="basic">Basic (6 Bulan)</option>
                <option value="pro">Pro (1 Tahun)</option>
              </select>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={durationDays}
                onChange={(e) => setDurationDays(cleanNumberInput(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Nama Lengkap Admin Sekolah (Full Name) *
              </label>
              <input
                type="text"
                placeholder="Contoh: Budi Santoso, S.Pd."
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Username Login Admin *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: admin_smpn1"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Password Admin *
                </label>
                <PasswordInput
                  placeholder="Password Kuat (Min 8 char) *"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>
            </div>
            <Button
              htmlType="submit"
              type="primary"
              loading={creatingSchool}
              className="w-full bg-indigo-600 h-10 rounded-xl font-bold text-xs"
            >
              Simpan & Aktifkan Sekolah
            </Button>
          </form>
        </Modal>

        {/* Modal Edit & Kelola Paket Sekolah */}
        <Modal
          open={!!editingSchool}
          onCancel={() => setEditingSchool(null)}
          onOk={handleSaveSchoolSub}
          confirmLoading={savingSchool}
          title={`⚙️ Edit Sekolah & Langganan — ${editingSchool?.name || ''}`}
          okText="Simpan Perubahan"
          cancelText="Batal"
          centered
        >
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Nama Sekolah *
              </label>
              <input
                type="text"
                value={editSchoolName}
                onChange={(e) => setEditSchoolName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nama Lengkap Admin (Full Name) *
                </label>
                <input
                  type="text"
                  placeholder="Nama Lengkap Admin"
                  value={editAdminFullName}
                  onChange={(e) => setEditAdminFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Username Login Admin *
                </label>
                <input
                  type="text"
                  placeholder="Username Login Admin"
                  value={editAdminUsername}
                  onChange={(e) => setEditAdminUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Reset Password Admin (Opsional — kosongkan jika tidak diubah)
              </label>
              <PasswordInput
                placeholder="Masukkan password baru (Min 8 karakter huruf+angka)"
                value={editAdminPassword}
                onChange={(e) => setEditAdminPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Paket</label>
              <select
                value={editPlan}
                onChange={(e) => handleEditPlanChange(e.target.value as SubscriptionPlanCode)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="trial">
                  Trial — Gratis ({SUBSCRIPTION_PLANS.trial.durationDays} Hari • {SUBSCRIPTION_PLANS.trial.maxStudents} Peserta • {SUBSCRIPTION_PLANS.trial.maxUsers} Akun • {SUBSCRIPTION_PLANS.trial.aiPlanCredits}x AI)
                </option>
                <option value="basic">
                  Basic — {formatIdr(SUBSCRIPTION_PLANS.basic.price)} ({SUBSCRIPTION_PLANS.basic.durationDays} Hari • {SUBSCRIPTION_PLANS.basic.maxStudents} Peserta • {SUBSCRIPTION_PLANS.basic.maxUsers} Akun • {SUBSCRIPTION_PLANS.basic.aiPlanCredits}x AI)
                </option>
                <option value="pro">
                  Pro (Most Popular) — {formatIdr(SUBSCRIPTION_PLANS.pro.price)} ({SUBSCRIPTION_PLANS.pro.durationDays} Hari • {SUBSCRIPTION_PLANS.pro.maxStudents} Peserta • {SUBSCRIPTION_PLANS.pro.maxUsers} Akun • {SUBSCRIPTION_PLANS.pro.aiPlanCredits}x AI)
                </option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as SubscriptionStatus)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Tambah Masa Aktif (Hari, 0 jika tetap)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={extendDays}
                  onChange={(e) => setExtendDays(cleanNumberInput(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-1">
                  🪙 Tambah Token AI Top-Up (+Token)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={topupAiCredits}
                  onChange={(e) => setTopupAiCredits(cleanNumberInput(e.target.value))}
                  className="w-full bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900"
                />
              </div>
            </div>
            {editingSchool && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Saldo Kuota AI Sekolah Saat Ini:</span>
                <span className="font-mono font-bold text-slate-900">
                  Total {editingSchool.ai_total_credits ?? 0} (Paket: {editingSchool.ai_plan_credits ?? 0} | Token: {editingSchool.ai_topup_credits ?? 0})
                </span>
              </div>
            )}
          </div>
        </Modal>

        {/* Modal Preview Detail Voucher & Lisensi */}
        <Modal
          open={!!previewVoucher}
          onCancel={() => setPreviewVoucher(null)}
          footer={null}
          title="🎟️ Preview Voucher / Kode Lisensi"
          centered
        >
          {previewVoucher && (() => {
            const benefitText =
              previewVoucher.voucher_type === 'ai_tokens'
                ? `+${previewVoucher.ai_tokens} Token Generate AI (Rollover / Tidak Hangus)`
                : previewVoucher.voucher_type === 'extend_days'
                ? `+${previewVoucher.duration_days} Hari Masa Aktif${
                    previewVoucher.ai_tokens > 0
                      ? ` • +${previewVoucher.ai_tokens} Token AI`
                      : ''
                  }`
                : `Lisensi Paket ${previewVoucher.plan_code.toUpperCase()} (${
                    previewVoucher.duration_days
                  } Hari)${
                    previewVoucher.ai_tokens > 0
                      ? ` • +${previewVoucher.ai_tokens} Token AI`
                      : ''
                  }`;

            const shareText = [
              '🎟️ *KODE VOUCHER / LISENSI SCOUTFN*',
              '',
              `• *Kode Voucher:* ${previewVoucher.code_preview}`,
              `• *Benefit:* ${benefitText}`,
              '',
              'Cara Klaim:',
              '1. Login sebagai Admin Sekolah di ScoutFN',
              '2. Buka menu *Pembayaran & Invoice*',
              '3. Masukkan kode di atas pada kolom *Klaim Kode Voucher / Lisensi* lalu klik Klaim.',
            ].join('\n');

            return (
              <div className="space-y-4 pt-2">
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 text-center space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                    Kode Voucher Lengkap
                  </div>
                  <div className="font-mono text-xl font-black text-emerald-950 tracking-wider select-all">
                    {previewVoucher.code_preview}
                  </div>
                  <div className="pt-1">
                    <Button
                      type="primary"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(previewVoucher.code_preview);
                        message.success(`Kode ${previewVoucher.code_preview} berhasil disalin!`);
                      }}
                      className="bg-emerald-600 hover:!bg-emerald-700 border-none rounded-xl text-xs font-bold"
                    >
                      Salin Kode Voucher
                    </Button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Jenis Voucher:</span>
                    <span className="font-bold text-slate-900 uppercase">
                      {previewVoucher.voucher_type === 'ai_tokens'
                        ? '🪙 Token Generate AI'
                        : previewVoucher.voucher_type === 'extend_days'
                        ? '⏳ Tambahan Masa Aktif'
                        : `🏫 Lisensi Paket ${previewVoucher.plan_code}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Isi Benefit:</span>
                    <span className="font-black text-indigo-700">{benefitText}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Kuota Pemakaian:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {previewVoucher.used_count} / {previewVoucher.max_uses} terpakai
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Status:</span>
                    <Tag
                      color={previewVoucher.is_active ? 'green' : 'default'}
                      className="m-0 text-[10px] font-bold uppercase"
                    >
                      {previewVoucher.is_active ? 'Tersedia / Aktif' : 'Sudah Terpakai / Nonaktif'}
                    </Tag>
                  </div>
                </div>

                <Button
                  block
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(shareText);
                    message.success('Pesan voucher siap kirim berhasil disalin!');
                  }}
                  className="h-10 rounded-xl font-bold text-xs"
                >
                  📋 Salin Pesan Lengkap (Siap Kirim ke WA Sekolah)
                </Button>
              </div>
            );
          })()}
        </Modal>
      </div>
    </div>
  );
}
