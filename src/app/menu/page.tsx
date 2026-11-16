'use client';

import React from 'react';
import Header from '@/components/Header';
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
  ArrowRightOutlined 
} from '@ant-design/icons';

interface MenuItem {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  badge: string;
  color: string;
}

export default function MenuDirectoryPage() {
  // Daftar semua menu yang ada di aplikasi Scout Management
  const menuList: MenuItem[] = [
    {
      title: 'Scan QR / Absensi',
      description: 'Lakukan pemindaian QR code presensi anggota atau input absensi secara manual.',
      path: '/scan', // Sesuaikan dengan route aslinya
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
      description: 'Kelola data seluruh anggota pramuka, regu, golongan, dan profil pengurus.',
      path: '/manajemen/siswa', // Sesuaikan dengan route aslinya
      icon: <TeamOutlined className="text-xl text-indigo-600" />,
      badge: 'Database',
      color: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300',
    },
    {
      title: 'Manajemen Pembina',
      description: 'Daftar data pembina, pelatih, serta penanggung jawab gugusdepan.',
      path: '/manajemen/pembina', // Sesuaikan dengan route aslinya
      icon: <UserOutlined className="text-xl text-blue-600" />,
      badge: 'Database',
      color: 'bg-blue-50 border-blue-100 hover:border-blue-300',
    },
    {
      title: 'Database Materi & Alat',
      description: 'Pusat data inventaris alat kepramukaan, tenda, pionering, dan referensi materi latihan.',
      path: '/materi', // Sesuaikan dengan route aslinya
      icon: <DatabaseOutlined className="text-xl text-amber-600" />,
      badge: 'Inventaris',
      color: 'bg-amber-50 border-amber-100 hover:border-amber-300',
    },
    {
      title: 'Laporan Nilai & Kehadiran',
      description: 'Rekapitulasi lengkap nilai latihan, pencapaian SKU, dan statistik kehadiran anggota.',
      path: '/laporan/nilai', // Sesuaikan dengan route aslinya
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
      path: '/laporan/log-harian', // Sesuaikan dengan route aslinya
      icon: <BookOutlined className="text-xl text-cyan-600" />,
      badge: 'Logbook',
      color: 'bg-cyan-50 border-cyan-100 hover:border-cyan-300',
    },
  ];

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