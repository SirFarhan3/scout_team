'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  toggleTheme: () => {},
  setThemeMode: () => {},
});

const STORAGE_KEY = 'scout_theme_preference';

export function useThemeMode() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1. Cek apakah user pernah menyimpan preferensi manual
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const initialMode: ThemeMode =
      saved === 'dark' || saved === 'light'
        ? saved
        : mediaQuery.matches
        ? 'dark'
        : 'light';

    setMode(initialMode);
    applyDomTheme(initialMode);

    // 2. Dengarkan perubahan tema sistem device jika user belum pernah memilih manual
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const manualPref = localStorage.getItem(STORAGE_KEY);
      if (!manualPref) {
        const nextMode: ThemeMode = e.matches ? 'dark' : 'light';
        setMode(nextMode);
        applyDomTheme(nextMode);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const applyDomTheme = (targetMode: ThemeMode) => {
    const root = document.documentElement;
    if (targetMode === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  };

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
    applyDomTheme(newMode);
  };

  const toggleTheme = () => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setThemeMode }}>
      <ConfigProvider
        theme={{
          algorithm:
            mounted && mode === 'dark'
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm,
          token:
            mounted && mode === 'dark'
              ? {
                  colorPrimary: '#7c83f7',
                  colorSuccess: '#38c493',
                  colorWarning: '#f2ae38',
                  colorError: '#f27289',
                  colorInfo: '#7c83f7',
                  colorBgContainer: '#171f30',
                  colorBgElevated: '#1e283d',
                  borderRadius: 12,
                }
              : {
                  colorPrimary: '#5b5fc7',
                  colorSuccess: '#229e73',
                  colorWarning: '#eba028',
                  colorError: '#df4f67',
                  colorInfo: '#5b5fc7',
                  borderRadius: 12,
                },
        }}
      >
        <AntdApp className="min-h-full flex flex-col flex-1">{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
