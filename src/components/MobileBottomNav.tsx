'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  HomeOutlined,
  QrcodeOutlined,
  TrophyOutlined,
  TeamOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Jangan tampilkan bottom nav di halaman login
  if (pathname === '/login') return null;

  const navItems = [
    {
      label: 'Beranda',
      href: '/',
      icon: <HomeOutlined className="text-base" />,
      active: pathname === '/',
    },
    {
      label: 'Anggota',
      href: '/manajemen/siswa',
      icon: <TeamOutlined className="text-base" />,
      active: pathname.startsWith('/manajemen/siswa'),
    },
    {
      label: 'Scan QR',
      href: '/scan',
      icon: <QrcodeOutlined className="text-lg" />,
      active: pathname.startsWith('/scan'),
      isPrimary: true,
    },
    {
      label: 'Ranking',
      href: '/ranking',
      icon: <TrophyOutlined className="text-base" />,
      active: pathname.startsWith('/ranking'),
    },
    {
      label: 'Menu',
      href: '/menu',
      icon: <AppstoreOutlined className="text-base" />,
      active: pathname.startsWith('/menu'),
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        {navItems.map((item) => {
          if (item.isPrimary) {
            return (
              <a
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition transform active:scale-95 ${
                    item.active
                      ? 'bg-emerald-600 text-white shadow-emerald-300/60'
                      : 'bg-indigo-600 text-white shadow-indigo-300/60'
                  }`}
                >
                  {item.icon}
                </div>
                <span
                  className={`text-[10px] font-extrabold mt-0.5 ${
                    item.active ? 'text-emerald-600' : 'text-indigo-600'
                  }`}
                >
                  {item.label}
                </span>
              </a>
            );
          }

          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition active:scale-95 ${
                item.active
                  ? 'text-indigo-600 font-extrabold'
                  : 'text-slate-400 hover:text-slate-700 font-semibold'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-0.5 leading-tight">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
