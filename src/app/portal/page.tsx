'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppstoreOutlined,
  LockOutlined,
  ArrowRightOutlined,
  QrcodeOutlined,
  TrophyOutlined,
  TeamOutlined,
  SoundOutlined,
  KeyOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';

export default function PortalPage() {
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService
      .getCurrentUser()
      .then((user) => {
        if (!user) {
          window.location.href = '/login';
          return;
        }
        if (user.role === 'superadmin') {
          window.location.href = '/superadmin';
          return;
        }
        if (user.school && !user.school.subscription_active) {
          window.location.href = '/billing';
          return;
        }
        setCurrentUser(user);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <PageLoader text="Memuat Portal Aplikasi..." />;
  }

  const managementTarget =
    currentUser?.role === 'instruktur' ? '/scan' : '/';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <Header
          title="Portal Utama Gugusdepan"
          subtitle={`Selamat datang, ${currentUser?.full_name || 'Kakak Pembina'}! Pilih modul yang ingin Anda gunakan.`}
        />

        {/* Banner Sambutan */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-100">
            ⚜️ Pilih Modul Aplikasi
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Mau Masuk ke Modul Apa Hari Ini?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Pilih <strong className="text-slate-700">Card Manajemen</strong> untuk mengelola presensi QR, anggota, regu, serta nilai latihan, atau pilih{' '}
            <strong className="text-slate-700">Card Translasi Sandi (Project Scout Chiper)</strong> untuk menerjemahkan berbagai sandi kepramukaan.
          </p>
        </div>

        {/* 2 Card Utama */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. CARD MANAJEMEN */}
          <Link
            href={managementTarget}
            className="group bg-white rounded-3xl p-6 sm:p-8 shadow-lg shadow-slate-200/50 border-2 border-indigo-100 hover:border-indigo-500 transition-all duration-200 flex flex-col justify-between space-y-6 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-md shadow-indigo-200 group-hover:scale-105 transition">
                  <AppstoreOutlined />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">
                  Modul 01 • Gugusdepan
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition">
                  Manajemen Pramuka
                </h3>
                <p className="text-xs font-bold text-indigo-600 mt-0.5">
                  Scout Management System
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Pusat kendali presensi QR Code anggota, klasemen ranking regu & siswa terbaik, manajemen poin, inventaris materi AI, program kerja tahunan, hingga rekap nilai Excel.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
                  <QrcodeOutlined className="text-emerald-600 text-base" />
                  <p className="text-[10px] font-bold text-slate-700 mt-1">Presensi QR</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
                  <TrophyOutlined className="text-amber-500 text-base" />
                  <p className="text-[10px] font-bold text-slate-700 mt-1">Ranking & Poin</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
                  <TeamOutlined className="text-indigo-600 text-base" />
                  <p className="text-[10px] font-bold text-slate-700 mt-1">Data Anggota</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-extrabold text-indigo-600">
                Buka Dashboard Manajemen
              </span>
              <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition">
                <ArrowRightOutlined />
              </span>
            </div>
          </Link>

          {/* 2. CARD TRANSLASI SANDI (PROJECT SCOUT CHIPER) */}
          <Link
            href="/sandi"
            className="group bg-white rounded-3xl p-6 sm:p-8 shadow-lg shadow-slate-200/50 border-2 border-emerald-100 hover:border-emerald-500 transition-all duration-200 flex flex-col justify-between space-y-6 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-200 group-hover:scale-105 transition">
                  <LockOutlined />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                  Modul 02 • Project Scout Chiper
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 group-hover:text-emerald-600 transition">
                  Translasi Sandi
                </h3>
                <p className="text-xs font-bold text-emerald-600 mt-0.5">
                  Project Scout Chiper • Encoder & Decoder
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Terjemahkan teks biasa menjadi Sandi Pramuka atau sebaliknya secara instan! Mendukung Sandi Morse (+ Audio & Rumput), Sandi AN, Sandi AZ, Sandi Angka, Koordinat Merah Putih, & Sandi Kotak.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
                  <SoundOutlined className="text-emerald-600 text-base" />
                  <p className="text-[10px] font-bold text-slate-700 mt-1">Morse & Rumput</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
                  <SwapOutlined className="text-indigo-600 text-base" />
                  <p className="text-[10px] font-bold text-slate-700 mt-1">Sandi AN / AZ</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
                  <KeyOutlined className="text-amber-500 text-base" />
                  <p className="text-[10px] font-bold text-slate-700 mt-1">Kotak & Angka</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-600">
                Buka Project Scout Chiper
              </span>
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition">
                <ArrowRightOutlined />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
