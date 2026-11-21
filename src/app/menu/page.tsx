'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';
import {
  QrcodeOutlined,
  TeamOutlined,
  UserOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  CalendarOutlined,
  BookOutlined,
  TrophyOutlined,
  FlagOutlined,
  CreditCardOutlined,
  SettingOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';

interface MenuItem {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  badge: string;
  color: string;
  adminOnly?: boolean;
}

export default function MenuDirectoryPage() {
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      if (!user) {
        window.location.href = '/login';
        return;
      }
      if (user.role === 'superadmin') {
        window.location.href = '/superadmin';
        return;
      }
      setCurrentUser(user);
      setLoading(false);
    });
  }, []);

  const menuList: MenuItem[] = [
    {
      title: 'Scan QR / Absensi',
      description: 'Lakukan pemindaian QR code presensi anggota atau input absensi secara manual.',
      path: '/scan',
      icon: <QrcodeOutlined className="text-xl text-emerald-600" />,
      badge: 'Presensi',
      color: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
    },
    {
      title: 'Klasemen Ranking & Minigames',
      description: 'Lihat klasemen regu terbaik, siswa terbaik, detail perolehan poin, serta input skor minigames dan keaktifan.',
      path: '/ranking',
      icon: <TrophyOutlined className="text-xl text-amber-600" />,
      badge: 'Leaderboard',
      color: 'bg-amber-50 border-amber-100 hover:border-amber-300',
    },
    {
      title: 'Manajemen Poin (+ / -)',
      description: 'Kelola master katalog poin penambahan (reward/minigame) & pengurangan (sanksi/evaluasi) di database serta riwayat poin.',
      path: '/manajemen/poin',
      icon: <BarChartOutlined className="text-xl text-emerald-600" />,
      badge: 'Master Poin',
      color: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
    },
    {
      title: 'Manajemen Regu',
      description: 'Tambahkan regu baru (Putra, Putri, Campuran), kelola anggota regu, dan pantau skor tiap regu.',
      path: '/manajemen/regu',
      icon: <FlagOutlined className="text-xl text-teal-600" />,
      badge: 'Database',
      color: 'bg-teal-50 border-teal-100 hover:border-teal-300',
    },
    {
      title: 'Manajemen Anggota',
      description: 'Kelola data seluruh anggota pramuka, regu, golongan, dan cetak kartu QR.',
      path: '/manajemen/siswa',
      icon: <TeamOutlined className="text-xl text-indigo-600" />,
      badge: 'Database',
      color: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300',
    },
    {
      title: 'Manajemen Pembina',
      description: 'Kelola akun pembina, pelatih, serta pembantu pembina khusus sekolah Anda.',
      path: '/manajemen/pembina',
      icon: <UserOutlined className="text-xl text-blue-600" />,
      badge: 'Admin',
      color: 'bg-blue-50 border-blue-100 hover:border-blue-300',
      adminOnly: true,
    },
    {
      title: 'Database Materi & Alat',
      description: 'Pusat data inventaris alat kepramukaan, tenda, pionering, dan referensi materi latihan.',
      path: '/materi',
      icon: <DatabaseOutlined className="text-xl text-amber-600" />,
      badge: 'Inventaris',
      color: 'bg-amber-50 border-amber-100 hover:border-amber-300',
    },
    {
      title: 'Laporan Nilai & Kehadiran',
      description: 'Rekapitulasi lengkap nilai latihan, ekspor Excel resmi sekolah, dan statistik kehadiran anggota.',
      path: '/laporan/nilai',
      icon: <BarChartOutlined className="text-xl text-purple-600" />,
      badge: 'Laporan',
      color: 'bg-purple-50 border-purple-100 hover:border-purple-300',
    },
    {
      title: 'Laporan Program Kerja',
      description: 'Rancangan program kerja tahunan gugusdepan, generator AI proker, dan jadwal latihan mingguan.',
      path: '/laporan/program-kerja',
      icon: <CalendarOutlined className="text-xl text-rose-600" />,
      badge: 'Program',
      color: 'bg-rose-50 border-rose-100 hover:border-rose-300',
    },
    {
      title: 'Laporan Log Harian',
      description: 'Catatan harian kegiatan latihan, dokumentasi, dan evaluasi rutin oleh pembina.',
      path: '/laporan/log-harian',
      icon: <BookOutlined className="text-xl text-cyan-600" />,
      badge: 'Logbook',
      color: 'bg-cyan-50 border-cyan-100 hover:border-cyan-300',
    },
    {
      title: 'Langganan & Lisensi Sekolah',
      description: 'Cek masa aktif paket sekolah, kuota anggota/akun, aktivasi kode lisensi, dan riwayat invoice.',
      path: '/billing',
      icon: <CreditCardOutlined className="text-xl text-amber-600" />,
      badge: 'Billing',
      color: 'bg-amber-50 border-amber-100 hover:border-amber-300',
      adminOnly: true,
    },
    {
      title: 'Pengaturan Sekolah & Keamanan',
      description: 'Perbarui profil sekolah pada dokumen cetak/Excel serta ganti password akun Anda.',
      path: '/pengaturan',
      icon: <SettingOutlined className="text-xl text-slate-600" />,
      badge: 'Keamanan',
      color: 'bg-slate-50 border-slate-200 hover:border-slate-300',
    },
  ].filter((m) => !m.adminOnly || currentUser?.role === 'admin');

  if (loading) {
    return <PageLoader text="Memuat Direktori Menu..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Halaman */}
        <Header 
          title="Direktori Menu Aplikasi" 
          subtitle="Pusat akses cepat ke seluruh modul dan fitur Scout Management" 
        />

        {/* Info Banner kecil */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Navigasi Utama Gugusdepan</h2>
            <p className="text-xs text-slate-400 mt-0.5">Pilih salah satu kartu menu di bawah untuk langsung menuju halaman terkait.</p>
          </div>
          <button 
            onClick={() => window.location.href = '/'}
            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition"
          >
            ← Kembali ke Dashboard
          </button>
        </div>

        {/* Grid Card Menu */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuList.map((menu, index) => (
            <div
              key={index}
              onClick={() => window.location.href = menu.path}
              className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer bg-white hover:shadow-md flex flex-col justify-between space-y-4 group`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-slate-100 ${menu.color}`}>
                    {menu.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    {menu.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {menu.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {menu.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                <span>Buka Menu</span>
                <ArrowRightOutlined className="transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}