'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { App } from 'antd';
import {
  SwapOutlined,
  CopyOutlined,
  ClearOutlined,
  SoundOutlined,
  StopOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { authService, UserSessionData } from '@/lib/auth';

type CipherType =
  | 'morse'
  | 'rumput'
  | 'an'
  | 'az'
  | 'angka'
  | 'koordinat'
  | 'caesar'
  | 'balik';

interface CipherOption {
  id: CipherType;
  name: string;
  badge: string;
  desc: string;
  keyHint: string;
}

const CIPHER_OPTIONS: CipherOption[] = [
  {
    id: 'morse',
    name: 'Sandi Morse',
    badge: 'Titik & Strip',
    desc: 'Mengubah huruf dan angka menjadi kombinasi titik (.) dan garis (-), lengkap dengan audio peluit.',
    keyHint: 'A = .- | B = -... | S = ... | O = --- (Pisah huruf dengan spasi, pisah kata dengan "/")',
  },
  {
    id: 'rumput',
    name: 'Sandi Rumput',
    badge: 'Turunan Morse',
    desc: 'Turunan Sandi Morse di mana titik (.) menjadi rumput pendek (^) dan strip (-) menjadi rumput tinggi (^^).',
    keyHint: 'Titik (.) = ^ | Strip (-) = ^^ | Pemisah huruf = ___',
  },
  {
    id: 'an',
    name: 'Sandi AN',
    badge: 'A = N (ROT13)',
    desc: 'Membagi abjad menjadi 2 baris: A–M berpasangan langsung dengan N–Z secara bolak-balik.',
    keyHint: 'A↔N | B↔O | C↔P | D↔Q | E↔R | F↔S | G↔T | H↔U | I↔V | J↔W | K↔X | L↔Y | M↔Z',
  },
  {
    id: 'az',
    name: 'Sandi AZ',
    badge: 'A = Z (Atbash)',
    desc: 'Membalik urutan abjad dari depan ke belakang: A berpasangan dengan Z, B dengan Y, dst.',
    keyHint: 'A↔Z | B↔Y | C↔X | D↔W | E↔V | F↔U | G↔T | H↔S | I↔R | J↔Q | K↔P | L↔O | M↔N',
  },
  {
    id: 'angka',
    name: 'Sandi Angka',
    badge: 'A = 1 .. Z = 26',
    desc: 'Mengganti setiap huruf dengan nomor urut abjadnya (A=1, B=2, ..., Z=26) dipisahkan tanda strip (-).',
    keyHint: 'A=1, B=2, C=3 ... Z=26 (Pisah huruf dalam kata dengan "-", pisah kata dengan "/")',
  },
  {
    id: 'koordinat',
    name: 'Sandi Koordinat (Merah Putih)',
    badge: '5×5 Grid',
    desc: 'Menggunakan kata kunci kolom MERAH dan baris PUTIH (5×5). Setiap huruf diwakili 2 huruf (Kolom+Baris).',
    keyHint: 'Kolom: M-E-R-A-H | Baris: P-U-T-I-H → A=MP, B=EP, C=RP, D=AP, E=HP, F=MU ... (I/J digabung)',
  },
  {
    id: 'caesar',
    name: 'Sandi Geser (Caesar)',
    badge: 'Geser Abjad',
    desc: 'Menggeser setiap huruf sejauh N langkah di dalam abjad (default geser 3: A→D, B→E, C→F).',
    keyHint: 'Geser +N huruf ke kanan saat Encode, dan geser -N huruf ke kiri saat Decode',
  },
  {
    id: 'balik',
    name: 'Sandi Balik Kata',
    badge: 'Mirror Kata',
    desc: 'Membalik urutan huruf pada setiap kata tanpa mengubah urutan katanya (PRAMUKA → AKUMARP).',
    keyHint: 'Setiap kata dibalik hurufnya satu per satu',
  },
];

const MORSE_MAP: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
};

const REVERSE_MORSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_MAP).map(([k, v]) => [v, k])
);

// Grid 5x5 Koordinat MERAH (Kolom) x PUTIH (Baris), I dan J berbagi sel atau Z=HH
const KOORDINAT_COLS = ['M', 'E', 'R', 'A', 'H'];
const KOORDINAT_ROWS = ['P', 'U', 'T', 'I', 'H'];
const KOORDINAT_ENCODE: Record<string, string> = {};
const KOORDINAT_DECODE: Record<string, string> = {};

(() => {
  const letters = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // 25 huruf (J digabung ke I)
  for (let i = 0; i < letters.length; i += 1) {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const code = `${KOORDINAT_COLS[c]}${KOORDINAT_ROWS[r]}`;
    KOORDINAT_ENCODE[letters[i]] = code;
    KOORDINAT_DECODE[code] = letters[i];
  }
  KOORDINAT_ENCODE.J = KOORDINAT_ENCODE.I;
})();

function transformAN(text: string): string {
  return text.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function transformAZ(text: string): string {
  return text.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + (25 - (ch.charCodeAt(0) - base)));
  });
}

function transformCaesar(text: string, shift: number): string {
  const normalizedShift = ((shift % 26) + 26) % 26;
  return text.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + normalizedShift) % 26) + base);
  });
}

function encodeMorse(text: string): string {
  return text
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('')
        .map((ch) => MORSE_MAP[ch] || ch)
        .join(' ')
    )
    .join(' / ');
}

function decodeMorse(code: string): string {
  return code
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => REVERSE_MORSE_MAP[token] || token)
        .join('')
    )
    .join(' ');
}

function encodeRumput(text: string): string {
  const morse = encodeMorse(text);
  return morse
    .split(' / ')
    .map((word) =>
      word
        .split(' ')
        .map((letterMorse) =>
          letterMorse
            .split('')
            .map((sym) => (sym === '.' ? '^' : sym === '-' ? '^^' : sym))
            .join(' ')
        )
        .join(' ___ ')
    )
    .join('  /  ');
}

function decodeRumput(code: string): string {
  const morse = code
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .split(/\s*___\s*/)
        .map((letterRumput) =>
          letterRumput
            .trim()
            .split(/\s+/)
            .map((t) => (t === '^^' ? '-' : t === '^' ? '.' : t))
            .join('')
        )
        .join(' ')
    )
    .join(' / ');
  return decodeMorse(morse);
}

function encodeAngka(text: string): string {
  return text
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('')
        .map((ch) => {
          const code = ch.charCodeAt(0);
          if (code >= 65 && code <= 90) return String(code - 64);
          return ch;
        })
        .join('-')
    )
    .join(' / ');
}

function decodeAngka(code: string): string {
  return code
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .trim()
        .split(/[-\s]+/)
        .filter(Boolean)
        .map((numStr) => {
          const n = Number(numStr);
          if (Number.isInteger(n) && n >= 1 && n <= 26) {
            return String.fromCharCode(64 + n);
          }
          return numStr;
        })
        .join('')
    )
    .join(' ');
}

function encodeKoordinat(text: string): string {
  return text
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('')
        .map((ch) => KOORDINAT_ENCODE[ch] || ch)
        .join('-')
    )
    .join(' / ');
}

function decodeKoordinat(code: string): string {
  return code
    .toUpperCase()
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .trim()
        .split(/[-\s]+/)
        .filter(Boolean)
        .map((pair) => KOORDINAT_DECODE[pair] || pair)
        .join('')
    )
    .join(' ');
}

function transformBalikKata(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : part.split('').reverse().join('')))
    .join('');
}

export default function SandiTranslatorPage() {
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const [cipherType, setCipherType] = useState<CipherType>('morse');
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [caesarShift, setCaesarShift] = useState<number>(3);
  const [inputText, setInputText] = useState<string>('SALAM PRAMUKA');
  const [playingAudio, setPlayingAudio] = useState<boolean>(false);
  const audioStopRef = useRef<boolean>(false);

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

  const activeCipher = useMemo(
    () => CIPHER_OPTIONS.find((c) => c.id === cipherType) || CIPHER_OPTIONS[0],
    [cipherType]
  );

  const outputText = useMemo(() => {
    if (!inputText.trim()) return '';
    switch (cipherType) {
      case 'morse':
        return direction === 'encode' ? encodeMorse(inputText) : decodeMorse(inputText);
      case 'rumput':
        return direction === 'encode' ? encodeRumput(inputText) : decodeRumput(inputText);
      case 'an':
        return transformAN(inputText);
      case 'az':
        return transformAZ(inputText);
      case 'angka':
        return direction === 'encode' ? encodeAngka(inputText) : decodeAngka(inputText);
      case 'koordinat':
        return direction === 'encode' ? encodeKoordinat(inputText) : decodeKoordinat(inputText);
      case 'caesar':
        return transformCaesar(inputText, direction === 'encode' ? caesarShift : -caesarShift);
      case 'balik':
        return transformBalikKata(inputText);
      default:
        return inputText;
    }
  }, [inputText, cipherType, direction, caesarShift]);

  // Kode Morse untuk visualisasi Rumput SVG & Audio Peluit
  const morseForPreview = useMemo(() => {
    if (!inputText.trim()) return '';
    if (cipherType === 'morse') {
      return direction === 'encode' ? outputText : inputText;
    }
    if (cipherType === 'rumput') {
      return direction === 'encode' ? encodeMorse(inputText) : encodeMorse(outputText);
    }
    return encodeMorse(direction === 'encode' ? inputText : outputText);
  }, [inputText, outputText, cipherType, direction]);

  const handleSwapDirection = () => {
    const currentOut = outputText;
    setDirection((prev) => (prev === 'encode' ? 'decode' : 'encode'));
    if (currentOut) {
      setInputText(currentOut);
    }
  };

  const handleCopyOutput = async () => {
    if (!outputText) {
      message.warning('Belum ada hasil translasi untuk disalin.');
      return;
    }
    try {
      await navigator.clipboard.writeText(outputText);
      message.success('Hasil translasi sandi berhasil disalin ke clipboard!');
    } catch {
      message.error('Gagal menyalin teks.');
    }
  };

  const playMorseAudio = async () => {
    const morse = morseForPreview.trim();
    if (!morse) {
      message.warning('Masukkan teks terlebih dahulu untuk memutar suara Morse.');
      return;
    }

    if (playingAudio) {
      audioStopRef.current = true;
      setPlayingAudio(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      setPlayingAudio(true);
      audioStopRef.current = false;

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const beep = async (durationMs: number) => {
        if (audioStopRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 750; // Frekuensi peluit pramuka
        gain.gain.value = 0.25;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        await sleep(durationMs);
        osc.stop();
      };

      for (const ch of morse) {
        if (audioStopRef.current) break;
        if (ch === '.') {
          await beep(110);
          await sleep(90);
        } else if (ch === '-') {
          await beep(320);
          await sleep(90);
        } else if (ch === ' ') {
          await sleep(180);
        } else if (ch === '/') {
          await sleep(360);
        }
      }

      await ctx.close();
    } catch {
      message.error('Browser tidak mendukung pemutar audio Web Audio API.');
    } finally {
      setPlayingAudio(false);
    }
  };

  if (loading) {
    return <PageLoader text="Memuat Translasi Sandi..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header
          title="Translasi Sandi • Translasi Sandi Pramuka"
          subtitle={`Generator & Decoder Sandi Kepramukaan Interaktif • ${currentUser?.school?.name || 'Gugusdepan'}`}
        />

        {/* Bar Navigasi Cepat ke Portal / Dashboard Manajemen */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg">
              🔐
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Pilih Jenis Sandi Pramuka
              </h2>
              <p className="text-xs text-slate-400">
                Mendukung enkripsi (Teks → Sandi) dan dekripsi (Sandi → Teks) secara real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/portal"
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1.5"
            >
              ← Kembali ke Portal 2 Card
            </Link>
            <Link
              href="/"
              className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1.5"
            >
              <AppstoreOutlined /> Dashboard Manajemen
            </Link>
          </div>
        </div>

        {/* Pilihan Tab Sandi */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CIPHER_OPTIONS.map((opt) => {
            const isSelected = opt.id === cipherType;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setCipherType(opt.id);
                  setDirection('encode');
                  setInputText('SALAM PRAMUKA');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200/60'
                    : 'bg-white text-slate-800 border-slate-200/80 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black">{opt.name}</span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 text-indigo-600'
                    }`}
                  >
                    {opt.badge}
                  </span>
                </div>
                <p
                  className={`text-[11px] line-clamp-2 ${
                    isSelected ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Kotak Input & Output Translasi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kolom Input */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {direction === 'encode'
                    ? '📝 Input Teks Biasa (Kalimat Asli)'
                    : `🔐 Input Kode ${activeCipher.name}`}
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {cipherType === 'caesar' && (
                    <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-600">Geser:</span>
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={caesarShift}
                        onChange={(e) =>
                          setCaesarShift(Math.min(25, Math.max(1, Number(e.target.value) || 1)))
                        }
                        className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-black text-center"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSwapDirection}
                    className="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 shadow-sm"
                  >
                    <SwapOutlined /> Tukar ({direction === 'encode' ? 'Teks → Sandi' : 'Sandi → Teks'})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setInputText(
                        direction === 'encode'
                          ? 'SATYAKU KUDARMAKAN DARMAKU KUBAKTIKAN'
                          : cipherType === 'morse'
                          ? '... .- .-.. .- -- / .--. .-. .- -- ..- -.- .-'
                          : 'SALAM PRAMUKA'
                      )
                    }
                    className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                  >
                    <ThunderboltOutlined /> Contoh
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition"
                  >
                    <ClearOutlined /> Bersihkan
                  </button>
                </div>
              </div>

              <textarea
                rows={6}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  direction === 'encode'
                    ? 'Ketik kalimat yang ingin diubah menjadi sandi...'
                    : `Tempel kode ${activeCipher.name} yang ingin diterjemahkan...`
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
              />
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>Karakter: {inputText.length}</span>
              <span>Kata: {inputText.trim() ? inputText.trim().split(/\s+/).length : 0}</span>
            </div>
          </div>

          {/* Kolom Output */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-600">
                  {direction === 'encode'
                    ? `✨ Hasil ${activeCipher.name}`
                    : '🔓 Hasil Terjemahan Teks Biasa'}
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={playMorseAudio}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition inline-flex items-center gap-1.5 ${
                      playingAudio
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                    }`}
                  >
                    {playingAudio ? <StopOutlined /> : <SoundOutlined />}
                    <span>{playingAudio ? 'Stop Peluit' : 'Putar Peluit Morse'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyOutput}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <CopyOutlined /> Salin Hasil
                  </button>
                </div>
              </div>

              <div className="w-full min-h-[152px] bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-mono font-bold text-indigo-700 break-words whitespace-pre-wrap select-all">
                {outputText || (
                  <span className="text-slate-400 font-normal">
                    Hasil translasi sandi akan muncul otomatis di sini...
                  </span>
                )}
              </div>
            </div>

            {/* Visualisasi Grafis Sandi Rumput */}
            {morseForPreview && (cipherType === 'morse' || cipherType === 'rumput') && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  🌿 Visualisasi Grafis Sandi Rumput
                </span>
                <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-3 overflow-x-auto">
                  <div className="flex items-end gap-1 min-w-max h-10 px-2 border-b-2 border-emerald-700">
                    {morseForPreview.split('').map((sym, idx) => {
                      if (sym === '.') {
                        return (
                          <div
                            key={idx}
                            title="Titik (.)"
                            className="w-1.5 h-3.5 bg-emerald-600 rounded-t-full"
                          />
                        );
                      }
                      if (sym === '-') {
                        return (
                          <div
                            key={idx}
                            title="Strip (-)"
                            className="w-1.5 h-8 bg-emerald-700 rounded-t-full"
                          />
                        );
                      }
                      if (sym === ' ') {
                        return <div key={idx} className="w-3 h-0.5" />;
                      }
                      if (sym === '/') {
                        return (
                          <div
                            key={idx}
                            title="Pemisah Kata"
                            className="w-6 flex items-center justify-center text-[10px] font-black text-emerald-700 pb-1"
                          >
                            •
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
