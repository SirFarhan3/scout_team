'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { App, Button, Popconfirm } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CopyOutlined,
  PrinterOutlined,
  WhatsAppOutlined,
  CloseCircleOutlined,
  QrcodeOutlined,
  BankOutlined,
} from '@ant-design/icons';
import PageLoader from '@/components/PageLoader';
import { authService } from '@/lib/auth';
import { billingService } from '@/services/billingService';
import { formatIdr } from '@/lib/plans';
import {
  PAYMENT_CONFIG,
  buildWhatsAppPaymentConfirmUrl,
} from '@/lib/payment-config';
import { terbilangRupiah } from '@/lib/terbilang';
import type { InvoiceDTO } from '@/types/school';

export default function UnifiedInvoicePage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const invoiceId = typeof params?.id === 'string' ? params.id : '';

  const [invoice, setInvoice] = useState<InvoiceDTO | null>(null);
  const [viewerRole, setViewerRole] = useState<string>('admin');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [qrisImageError, setQrisImageError] = useState(false);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const user = await authService.getCurrentUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      const res = await billingService.getInvoiceById(invoiceId);
      setInvoice(res.invoice);
      setViewerRole(res.viewerRole || user.role);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat dokumen invoice.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!invoiceId) return;
    loadInvoice();
  }, [invoiceId]);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} berhasil disalin!`);
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;
    try {
      setProcessingAction(true);
      const res = await billingService.markInvoicePaid(invoice.id);
      message.success(res.message || 'Invoice berhasil dikonfirmasi LUNAS!');
      setInvoice(res.invoice);
    } catch (err: unknown) {
      message.error(
        err instanceof Error ? err.message : 'Gagal mengonfirmasi pelunasan invoice.'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    try {
      setProcessingAction(true);
      const res = await billingService.cancelInvoice(invoice.id);
      message.success(res.message || 'Invoice telah dibatalkan.');
      setInvoice(res.invoice);
    } catch (err: unknown) {
      message.error(
        err instanceof Error ? err.message : 'Gagal membatalkan invoice.'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) {
    return <PageLoader text="Memuat Dokumen Invoice..." />;
  }

  const backHref = viewerRole === 'superadmin' ? '/superadmin' : '/billing';

  if (errorMsg || !invoice) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center space-y-4">
          <div className="text-4xl">📄</div>
          <h1 className="text-lg font-black text-slate-900">
            Dokumen Invoice Tidak Dapat Diakses
          </h1>
          <p className="text-xs text-slate-500">
            {errorMsg || 'Invoice tidak ditemukan atau Anda tidak memiliki akses.'}
          </p>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition"
          >
            <ArrowLeftOutlined /> Kembali
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';
  const isPending = invoice.status === 'pending';
  const isCancelled = invoice.status === 'cancelled';
  const isSuperadmin = viewerRole === 'superadmin';
  const canCancel = isPending && (isSuperadmin || viewerRole === 'admin');

  const formattedTotal = formatIdr(invoice.total_amount);
  const waConfirmUrl = buildWhatsAppPaymentConfirmUrl({
    invoiceNumber: invoice.invoice_number,
    schoolName: invoice.school_name,
    itemName: invoice.item_name,
    totalAmountFormatted: formattedTotal,
  });

  const formatDateId = (iso?: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTimeId = (iso?: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="invoice-print-wrapper min-h-screen print:min-h-0 bg-slate-200/80 py-6 px-3 sm:px-6 print:bg-white print:p-0 font-sans text-slate-900">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
          }
        }
      `}</style>

      {/* Toolbar Atas (Disembunyikan saat Print / Save as PDF) */}
      <div className="max-w-[210mm] mx-auto mb-4 print:hidden flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition"
        >
          <ArrowLeftOutlined />
          <span>
            {isSuperadmin ? 'Kembali ke Panel Superadmin' : 'Kembali ke Pembayaran & Invoice'}
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperadmin && isPending && (
            <Popconfirm
              title="Konfirmasi pelunasan invoice ini?"
              description="Paket sekolah atau Token AI akan langsung aktif secara otomatis."
              okText="Ya, Konfirmasi Lunas"
              cancelText="Batal"
              onConfirm={handleMarkAsPaid}
            >
              <Button
                type="primary"
                loading={processingAction}
                icon={<CheckCircleFilled />}
                className="bg-emerald-600 hover:!bg-emerald-700 border-none rounded-xl text-xs font-bold h-9"
              >
                Konfirmasi Lunas
              </Button>
            </Popconfirm>
          )}

          {canCancel && (
            <Popconfirm
              title="Batalkan tagihan ini?"
              description="Status invoice akan diubah menjadi Dibatalkan."
              okText="Ya, Batalkan"
              cancelText="Tidak"
              okButtonProps={{ danger: true }}
              onConfirm={handleCancelInvoice}
            >
              <Button
                danger
                loading={processingAction}
                icon={<CloseCircleOutlined />}
                className="rounded-xl text-xs font-bold h-9"
              >
                Batalkan
              </Button>
            </Popconfirm>
          )}

          <Button
            type={isPaid ? 'primary' : 'default'}
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
            className={`rounded-xl text-xs font-bold h-9 ${
              isPaid ? 'bg-indigo-600 hover:!bg-indigo-700 border-none' : ''
            }`}
          >
            {isPaid ? 'Cetak / Simpan PDF (Kwitansi)' : 'Cetak Tagihan'}
          </Button>
        </div>
      </div>

      {/* Lembar Dokumen Formal Ukuran A4 */}
      <div className="invoice-print-sheet max-w-[210mm] mx-auto bg-white rounded-3xl print:rounded-none shadow-xl print:shadow-none border border-slate-200 print:border-none p-6 sm:p-10 print:p-0 space-y-6 print:space-y-4 relative overflow-hidden print:overflow-visible">
        {/* Header Identitas Dokumen */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-slate-900">
          <div className="flex items-start gap-3.5">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
              <img
                src="/logo.jpg"
                alt="Logo ScoutFN"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900">
                {PAYMENT_CONFIG.issuerName}
              </div>
              <div className="text-xs font-bold text-indigo-700">
                {PAYMENT_CONFIG.issuerRole}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {PAYMENT_CONFIG.issuerSubtitle}
              </div>
            </div>
          </div>

          <div className="sm:text-right space-y-1.5">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">
              {isPaid ? 'KWITANSI & BUKTI PEMBAYARAN' : 'TAGIHAN PEMBAYARAN (INVOICE)'}
            </div>
            <div className="font-mono text-base sm:text-lg font-black text-slate-900">
              {invoice.invoice_number}
            </div>
            <div>
              {isPaid && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border-2 border-emerald-600">
                  <CheckCircleFilled /> LUNAS (PAID)
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-400">
                  ⏳ MENUNGGU PEMBAYARAN
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                  ✖ DIBATALKAN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Informasi Penerima / Sekolah & Metadata Tanggal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Diterbitkan Untuk Sekolah / Gugusdepan:
            </div>
            <div className="text-base font-black text-slate-900">
              {invoice.school_name}
            </div>
            {invoice.gugusdepan && (
              <div className="text-xs font-semibold text-slate-600">
                Gugusdepan: {invoice.gugusdepan}
              </div>
            )}
            {invoice.contact_name && (
              <div className="text-xs text-slate-600">
                Penanggung Jawab: <strong className="text-slate-800">{invoice.contact_name}</strong>
              </div>
            )}
            {invoice.contact_email && (
              <div className="text-xs text-slate-500">{invoice.contact_email}</div>
            )}
          </div>

          <div className="space-y-1.5 text-xs sm:text-right">
            <div>
              <span className="text-slate-400 font-semibold">Tanggal Diterbitkan: </span>
              <strong className="text-slate-800">{formatDateId(invoice.created_at)}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Metode Pembayaran: </span>
              <strong className="text-slate-800">{invoice.payment_method}</strong>
            </div>
            {isPaid && invoice.paid_at && (
              <div>
                <span className="text-emerald-700 font-bold">Tanggal Pelunasan: </span>
                <strong className="text-emerald-800 font-black">
                  {formatDateTimeId(invoice.paid_at)}
                </strong>
              </div>
            )}
            {isPaid &&
              invoice.item_type === 'subscription' &&
              invoice.period_end && (
                <div className="pt-1">
                  <span className="inline-block bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                    Periode Aktif Hingga: {formatDateId(invoice.period_end)}
                  </span>
                </div>
              )}
          </div>
        </div>

        {/* Tabel Rincian Item */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-extrabold">Deskripsi Layanan / Item</th>
                <th className="py-3 px-4 font-extrabold text-center w-28">Kategori</th>
                <th className="py-3 px-4 font-extrabold text-right w-40">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              <tr>
                <td className="py-4 px-4">
                  <div className="font-black text-sm text-slate-900">{invoice.item_name}</div>
                  {invoice.item_description && (
                    <div className="text-slate-500 mt-1 leading-relaxed">
                      {invoice.item_description}
                    </div>
                  )}
                </td>
                <td className="py-4 px-4 text-center font-bold text-slate-600 uppercase text-[11px]">
                  {invoice.item_type === 'topup' ? 'Token AI' : 'Langganan'}
                </td>
                <td className="py-4 px-4 text-right font-bold text-slate-900 text-sm">
                  {formatIdr(invoice.amount)}
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs">
              {invoice.discount > 0 && (
                <tr>
                  <td colSpan={2} className="py-2.5 px-4 text-right font-bold text-slate-500">
                    Potongan / Diskon
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                    - {formatIdr(invoice.discount)}
                  </td>
                </tr>
              )}
              <tr>
                <td
                  colSpan={2}
                  className="py-3.5 px-4 text-right font-black text-sm text-slate-900 uppercase"
                >
                  {isPaid ? 'Total Dibayar' : 'Total Tagihan'}
                </td>
                <td className="py-3.5 px-4 text-right font-black text-lg text-indigo-700">
                  {formattedTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Kotak Terbilang */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
            Terbilang:
          </span>
          <span className="text-xs sm:text-sm font-black italic text-slate-900">
            # {terbilangRupiah(invoice.total_amount)} #
          </span>
        </div>

        {/* TAMPILAN KHUSUS STATUS PENDING: INSTRUKSI PEMBAYARAN & TOMBOL WHATSAPP */}
        {isPending && (
          <div className="space-y-5 pt-2 print:hidden">
            <div className="border-2 border-indigo-200 bg-indigo-50/30 rounded-3xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    💳 Instruksi Pembayaran Tagihan
                  </h2>
                  <p className="text-xs text-slate-500">
                    Silakan lakukan pembayaran sejumlah{' '}
                    <strong className="text-indigo-700">{formattedTotal}</strong> melalui salah satu metode di bawah ini:
                  </p>
                </div>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() =>
                    handleCopyText(String(invoice.total_amount), 'Nominal tagihan')
                  }
                  className="rounded-xl text-xs font-bold self-start sm:self-auto"
                >
                  Salin Nominal ({formattedTotal})
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Opsi 1: Transfer Bank */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
                      <BankOutlined className="text-base" />
                      <span>1. Transfer Rekening Bank</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">
                          Nama Bank
                        </span>
                        <span className="font-black text-sm text-slate-900">
                          {PAYMENT_CONFIG.bank.bankName}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">
                          Nomor Rekening
                        </span>
                        <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-0.5">
                          <span className="font-mono font-black text-base text-indigo-700 tracking-wide">
                            {PAYMENT_CONFIG.bank.accountNumber}
                          </span>
                          <Button
                            size="small"
                            type="primary"
                            icon={<CopyOutlined />}
                            onClick={() =>
                              handleCopyText(
                                PAYMENT_CONFIG.bank.accountNumber,
                                'Nomor Rekening'
                              )
                            }
                            className="bg-indigo-600 rounded-lg text-[11px] font-bold"
                          >
                            Salin
                          </Button>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">
                          Atas Nama
                        </span>
                        <span className="font-bold text-slate-800">
                          {PAYMENT_CONFIG.bank.accountHolder}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    💡 Cantumkan berita transfer:{' '}
                    <strong className="font-mono text-slate-800">
                      {invoice.invoice_number}
                    </strong>
                  </div>
                </div>

                {/* Opsi 2: QRIS */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase tracking-wider">
                    <QrcodeOutlined className="text-base" />
                    <span>2. Scan QRIS (Semua E-Wallet & M-Banking)</span>
                  </div>

                  {!qrisImageError ? (
                    <div className="w-48 h-48 rounded-2xl border border-slate-200 p-2 bg-white flex items-center justify-center overflow-hidden">
                      <img
                        src={PAYMENT_CONFIG.qrisImagePath}
                        alt="QRIS ScoutFN"
                        className="w-full h-full object-contain"
                        onError={() => setQrisImageError(true)}
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 flex flex-col items-center justify-center text-center space-y-1.5">
                      <QrcodeOutlined className="text-4xl text-slate-400" />
                      <div className="text-xs font-black text-slate-700">
                        QRIS {PAYMENT_CONFIG.issuerName}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        Gunakan Transfer Rekening Bank di samping atau minta kode QRIS melalui tombol WhatsApp di bawah.
                      </p>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500">
                    Merchant: <strong className="text-slate-800">{PAYMENT_CONFIG.issuerName}</strong>
                  </div>
                </div>
              </div>

              {/* Tombol Utama Konfirmasi Pembayaran via WhatsApp */}
              <div className="pt-2">
                <a
                  href={waConfirmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-4 px-6 rounded-2xl shadow-lg shadow-emerald-200 transition flex items-center justify-center gap-2.5"
                >
                  <WhatsAppOutlined className="text-lg" />
                  <span>Konfirmasi Pembayaran via WhatsApp</span>
                </a>
                <p className="text-[11px] text-center text-slate-500 mt-2">
                  Setelah transfer/scan QRIS, klik tombol di atas untuk mengirim rincian invoice ke WhatsApp Pengelola ScoutFN agar langsung diaktifkan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAMPILAN KHUSUS STATUS PAID: PENGESAHAN KWITANSI LUNAS */}
        {isPaid && (
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row print:flex-row items-start sm:items-end print:items-end justify-between gap-6 print:break-inside-avoid">
            <div className="space-y-2 max-w-md">
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                <CheckCircleFilled /> Sah Tanpa Tanda Tangan Basah
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Dokumen ini diterbitkan secara elektronik oleh sistem{' '}
                <strong>{PAYMENT_CONFIG.issuerName}</strong> dan merupakan bukti pembayaran yang sah setelah pembayaran terverifikasi lunas pada{' '}
                <strong>{formatDateTimeId(invoice.paid_at)}</strong>.
              </p>
            </div>

            <div className="sm:text-right space-y-3 shrink-0">
              <div className="text-[11px] font-bold text-slate-400 uppercase">
                Diterbitkan Oleh,
              </div>
              <div className="inline-block border-2 border-emerald-600 text-emerald-700 font-black text-xs uppercase tracking-widest px-4 py-1.5 rounded-xl -rotate-2">
                ✓ TERVERIFIKASI LUNAS
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">
                  {PAYMENT_CONFIG.issuerName}
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {PAYMENT_CONFIG.issuerRole}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
