'use client';

import React, { useEffect, useState } from 'react';
import { App, Button, Card, Modal, Popconfirm, Table, Tag } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  KeyOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import PasswordInput from '@/components/PasswordInput';
import { authService } from '@/lib/auth';
import { superadminService, SuperadminSchoolItem } from '@/services/superadminService';
import { formatIdr } from '@/lib/plans';
import type {
  InvoiceDTO,
  LicenseKeyDTO,
  PaidPlanCode,
  SubscriptionPlanCode,
  SubscriptionStatus,
} from '@/types/school';

export default function SuperadminPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SuperadminSchoolItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKeyDTO[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'schools' | 'invoices' | 'keys' | 'audit'>('schools');

  // Modal Tambah Sekolah Manual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [city, setCity] = useState('');
  const [gugusdepan, setGugusdepan] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [plan, setPlan] = useState<SubscriptionPlanCode>('pro');
  const [durationDays, setDurationDays] = useState(365);
  const [creatingSchool, setCreatingSchool] = useState(false);

  // Modal Kelola Langganan & Edit Sekolah
  const [editingSchool, setEditingSchool] = useState<SuperadminSchoolItem | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editAdminFullName, setEditAdminFullName] = useState('');
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editPlan, setEditPlan] = useState<SubscriptionPlanCode>('pro');
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>('active');
  const [extendDays, setExtendDays] = useState<number>(0);
  const [savingSchool, setSavingSchool] = useState(false);

  // Form Generate License Key
  const [keyPlan, setKeyPlan] = useState<PaidPlanCode>('pro');
  const [keyDays, setKeyDays] = useState<number>(365);
  const [keyMaxUses, setKeyMaxUses] = useState<number>(1);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [latestGeneratedCode, setLatestGeneratedCode] = useState<string | null>(null);

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
        durationDays,
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
    try {
      setSavingSchool(true);
      await superadminService.updateSchool(editingSchool.id, {
        name: editSchoolName,
        adminFullName: editAdminFullName,
        ...(editAdminUsername.trim() ? { adminUsername: editAdminUsername.trim() } : {}),
        ...(editAdminPassword.trim() ? { adminPassword: editAdminPassword.trim() } : {}),
        subscription_plan: editPlan,
        subscription_status: editStatus,
        ...(extendDays > 0 ? { extendDays } : {}),
      });
      message.success('Data sekolah, admin, dan langganan berhasil diperbarui!');
      setEditingSchool(null);
      setEditAdminPassword('');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memperbarui sekolah.');
    } finally {
      setSavingSchool(false);
    }
  };

  const handleProcessInvoice = async (id: string, action: 'approve' | 'reject') => {
    try {
      await superadminService.processInvoice(id, action);
      message.success(
        action === 'approve'
          ? 'Pembayaran disetujui & paket sekolah langsung aktif!'
          : 'Invoice ditolak.'
      );
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal memproses invoice.');
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGeneratingKey(true);
      const res = await superadminService.generateLicenseKey({
        planCode: keyPlan,
        durationDays: keyDays,
        maxUses: keyMaxUses,
      });
      setLatestGeneratedCode(res.plainCode);
      message.success('Kode lisensi berhasil dibuat!');
      await loadData();
    } catch (err: any) {
      message.error(err.message || 'Gagal membuat kode lisensi.');
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

  const PLAN_DEFAULT_DAYS: Record<SubscriptionPlanCode, number> = {
    trial: 7,
    basic: 180,
    pro: 365,
  };

  const handlePlanChange = (selectedPlan: SubscriptionPlanCode) => {
    setPlan(selectedPlan);
    setDurationDays(PLAN_DEFAULT_DAYS[selectedPlan]);
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
        <div className="text-xs text-slate-600">
          <div>
            Siswa: <strong>{rec.student_count}</strong>/{rec.max_students}
          </div>
          <div>
            Akun: <strong>{rec.user_count}</strong>/{rec.max_users}
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
              setExtendDays(0);
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

  const invoiceColumns = [
    {
      title: 'Invoice',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (val: string) => <span className="font-mono font-bold text-xs">{val}</span>,
    },
    {
      title: 'Sekolah',
      dataIndex: 'school_name',
      key: 'school_name',
      render: (val: string) => <span className="font-bold text-xs">{val}</span>,
    },
    {
      title: 'Paket & Nominal',
      key: 'amount',
      render: (_: any, rec: InvoiceDTO) => (
        <div className="text-xs">
          <strong className="uppercase text-indigo-700">{rec.plan_code}</strong> ({rec.billing_cycle}) —{' '}
          {rec.amount_idr > 0 ? formatIdr(rec.amount_idr) : 'Lisensi'}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <Tag
          color={val === 'paid' ? 'green' : val === 'pending' ? 'gold' : 'red'}
          className="uppercase font-bold text-[10px]"
        >
          {val}
        </Tag>
      ),
    },
    {
      title: 'Bukti / Catatan',
      key: 'note',
      render: (_: any, rec: InvoiceDTO) => (
        <div className="text-xs text-slate-500">
          {rec.payment_reference && <div className="font-mono">{rec.payment_reference}</div>}
          {rec.payer_note && <div>{rec.payer_note}</div>}
        </div>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: any, rec: InvoiceDTO) =>
        rec.status === 'pending' ? (
          <div className="flex gap-1.5">
            <Popconfirm
              title="Setujui pembayaran dan aktifkan sekolah?"
              onConfirm={() => handleProcessInvoice(rec.id, 'approve')}
            >
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                className="bg-emerald-600 rounded-lg text-xs"
              >
                Aktifkan
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Tolak invoice ini?"
              onConfirm={() => handleProcessInvoice(rec.id, 'reject')}
            >
              <Button size="small" danger icon={<CloseOutlined />} className="rounded-lg text-xs" />
            </Popconfirm>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Selesai</span>
        ),
    },
  ];

  const keyColumns = [
    {
      title: 'Kode Preview',
      dataIndex: 'code_preview',
      key: 'code_preview',
      render: (val: string) => <span className="font-mono font-bold text-xs">{val}</span>,
    },
    {
      title: 'Paket',
      dataIndex: 'plan_code',
      key: 'plan_code',
      render: (val: string) => <Tag color="geekblue" className="uppercase text-[10px] font-bold">{val}</Tag>,
    },
    {
      title: 'Durasi',
      dataIndex: 'duration_days',
      key: 'duration_days',
      render: (val: number) => <span className="text-xs font-semibold">{val} Hari</span>,
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
      render: (_: any, rec: LicenseKeyDTO) =>
        rec.is_active ? (
          <Popconfirm title="Nonaktifkan kode lisensi ini?" onConfirm={() => handleRevokeKey(rec.id)}>
            <Button size="small" danger className="rounded-lg text-xs">
              Cabut
            </Button>
          </Popconfirm>
        ) : (
          <span className="text-xs text-slate-400">-</span>
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
              🔑 Kode Lisensi ({licenseKeys.length})
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
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <Card className="rounded-2xl shadow-none border border-slate-100 overflow-hidden" styles={{ body: { padding: 0 } }}>
              <Table dataSource={invoices} columns={invoiceColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 800 }} />
            </Card>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyOutlined className="text-emerald-600" /> Buat Kode Lisensi Baru
              </h2>
              <form onSubmit={handleGenerateKey} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Paket</label>
                  <select
                    value={keyPlan}
                    onChange={(e) => setKeyPlan(e.target.value as PaidPlanCode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Masa Aktif (Hari)</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={keyDays}
                    onChange={(e) => setKeyDays(Number(e.target.value) || 30)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Maks Pemakaian</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={keyMaxUses}
                    onChange={(e) => setKeyMaxUses(Number(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                  />
                </div>
                <Button htmlType="submit" type="primary" loading={generatingKey} className="bg-emerald-600 border-none h-10 rounded-xl font-bold text-xs">
                  Generate Kode
                </Button>
              </form>

              {latestGeneratedCode && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-700 uppercase">
                      Salin Kode Lisensi Sekarang (Hanya Ditampilkan Sekali):
                    </div>
                    <div className="text-lg font-mono font-black text-emerald-900">
                      {latestGeneratedCode}
                    </div>
                  </div>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(latestGeneratedCode);
                      message.success('Kode disalin!');
                    }}
                  >
                    Salin
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
                type="number"
                min={1}
                max={3650}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value) || 1)}
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
                onChange={(e) => setEditPlan(e.target.value as SubscriptionPlanCode)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
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
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Tambah Masa Aktif (Hari, 0 jika tidak ditambah)
              </label>
              <input
                type="number"
                min={0}
                max={3650}
                value={extendDays}
                onChange={(e) => setExtendDays(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
