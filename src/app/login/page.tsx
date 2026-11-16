'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { authService } from '@/lib/auth';
import { useThemeMode } from '@/components/ThemeProvider';

export default function LoginPage() {
  const router = useRouter();
  const { mode, toggleTheme } = useThemeMode();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username || !password) {
      setErrorMsg('Username dan password wajib diisi!');
      return;
    }

    try {
      setLoading(true);

      // Authenticate via username & password
      const user = await authService.login(username, password);

      // Redirect berdasarkan role
      if (user.role === 'admin' || user.role === 'pembina') {
        window.location.href = '/manajemen/siswa';
      } else {
        router.push('/scan');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login gagal. Periksa kembali username dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-slate-100 space-y-6 relative">
        {/* Toggle Dark/Light Mode */}
        <button
          type="button"
          onClick={toggleTheme}
          title={mode === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          className="absolute top-5 right-5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
        >
          {mode === 'dark' ? (
            <>
              <SunOutlined className="text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <MoonOutlined className="text-indigo-600" />
              <span>Dark</span>
            </>
          )}
        </button>

        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-3xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-lg">
            <img
              src="/logo.jpg"
              alt="Logo Scout Team"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Scout Portal</h1>
          <p className="text-xs text-slate-400 font-medium">
            Masuk dengan Username Pembina / Instruktur
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Username Pembina
            </label>
            <input
              type="text"
              placeholder="Contoh: scout_team"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 pt-3"
          >
            {loading ? 'Memverifikasi...' : '🔐 Masuk ke Sistem'}
          </button>
        </form>
      </div>
    </div>
  );
}
