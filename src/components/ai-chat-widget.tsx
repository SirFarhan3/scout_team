'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { authService, type UserSessionData } from '@/lib/auth';
import { getJwtToken } from '@/lib/apiClient';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  user_name?: string | null;
  content: string;
  created_at: string;
}

const MAX_CHARS = 1000;

const QUICK_PROMPTS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: 'Ide game 15 menit',
    prompt:
      'Berikan 3 ide game ice breaking Pramuka berdurasi 15 menit yang seru, minim alat, dan melatih kekompakan regu.',
  },
  {
    label: 'Susunan upacara latihan',
    prompt:
      'Buatkan susunan upacara pembukaan dan penutupan latihan rutin Pramuka yang ringkas sesuai pedoman Kwarnas.',
  },
  {
    label: 'Kisi-kisi ujian SKU',
    prompt:
      'Berikan panduan praktis dan kisi-kisi pengujian poin SKU agar efektif dilakukan saat latihan rutin.',
  },
  {
    label: 'Sandi & semaphore',
    prompt:
      'Berikan tips cepat dan ide latihan kreatif untuk mengajarkan sandi Pramuka dan semaphore kepada peserta didik.',
  },
];

const HIDDEN_PATH_PREFIXES = ['/login', '/register', '/superadmin', '/invoice'];

function isHiddenPath(pathname: string): boolean {
  return HIDDEN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Render teks inline dengan dukungan **bold** dan `code` secara aman (tanpa dangerouslySetInnerHTML).
 */
function renderInlineFormatting(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${idx}`} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="px-1 py-0.5 rounded bg-slate-200/70 text-[11px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
  });
}

/**
 * Render pesan asisten dengan dukungan list (- / * / 1.), heading sederhana, bold, dan paragraf.
 */
function FormattedAssistantMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Bullet list (- atau *)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={`uli-${i}-${idx}`} className="leading-relaxed">
              {renderInlineFormatting(item, `uli-${i}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list (1. 2. dst.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={`oli-${i}-${idx}`} className="leading-relaxed">
              {renderInlineFormatting(item, `oli-${i}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Heading markdown (# / ## / ###)
    if (/^#{1,3}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,3}\s+/, '');
      blocks.push(
        <p key={`h-${i}`} className="font-extrabold text-[13px] mt-2 mb-0.5">
          {renderInlineFormatting(headingText, `h-${i}`)}
        </p>
      );
      i += 1;
      continue;
    }

    // Paragraf biasa
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed my-1 first:mt-0 last:mb-0">
        {renderInlineFormatting(trimmed, `p-${i}`)}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-1 break-words">{blocks}</div>;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function AiChatWidget() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(() =>
    authService.getCachedUser()
  );
  const [authChecked, setAuthChecked] = useState<boolean>(() =>
    Boolean(authService.getCachedUser())
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const shouldHide = isHiddenPath(pathname);

  // Cek sesi user agar widget hanya muncul bagi pembina/admin sekolah yang login
  useEffect(() => {
    if (shouldHide || currentUser) {
      return;
    }

    let cancelled = false;
    authService
      .getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setCurrentUser(user);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, shouldHide, currentUser]);

  const getAuthHeaders = useCallback(async (includeJson = false): Promise<Record<string, string>> => {
    let token = getJwtToken();
    if (!token) {
      await authService.getCurrentUser();
      token = getJwtToken();
    }
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      setErrorMsg(null);
      const headers = await getAuthHeaders(false);
      const res = await fetch('/api/ai/chat', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal memuat riwayat obrolan.');
      }
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setHistoryLoaded(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat riwayat obrolan.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [getAuthHeaders]);

  const handleOpenChat = () => {
    setIsOpen(true);
    if (!historyLoaded && currentUser?.school_id) {
      void fetchHistory();
    }
  };

  // Auto-scroll ke pesan terbaru saat riwayat dimuat atau teks streaming masuk
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
    }
  }, [messages, isOpen, isStreaming]);

  // Fokus ke textarea saat panel dibuka
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || isStreaming) return;
      if (trimmed.length > MAX_CHARS) {
        setErrorMsg(`Pesan maksimal ${MAX_CHARS} karakter.`);
        return;
      }

      setErrorMsg(null);
      setConfirmClear(false);
      setInput('');
      setIsStreaming(true);

      const nowIso = new Date().toISOString();
      const tempUserId = `temp-user-${Date.now()}`;
      const tempAssistantId = `temp-ai-${Date.now() + 1}`;

      const optimisticUser: ChatMessage = {
        id: tempUserId,
        role: 'user',
        user_name: currentUser?.full_name || 'Pembina',
        content: trimmed,
        created_at: nowIso,
      };
      const optimisticAssistant: ChatMessage = {
        id: tempAssistantId,
        role: 'assistant',
        user_name: 'Kakak Pembina AI',
        content: '',
        created_at: nowIso,
      };

      setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);

      try {
        const headers = await getAuthHeaders(true);
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          credentials: 'same-origin',
          headers,
          body: JSON.stringify({ message: trimmed }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.error || errData?.message || `Gagal menghubungi Kakak Pembina AI (${res.status}).`
          );
        }

        if (!res.body) {
          throw new Error('Browser tidak mendukung streaming respons.');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value, { stream: true });
          if (chunkText) {
            accumulated += chunkText;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId ? { ...m, content: accumulated } : m
              )
            );
          }
        }

        const tail = decoder.decode();
        if (tail) {
          accumulated += tail;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId ? { ...m, content: accumulated } : m
            )
          );
        }

        if (!accumulated.trim()) {
          throw new Error('Balasan AI kosong. Pesan tidak disimpan ke riwayat.');
        }
      } catch (err: unknown) {
        // Hapus pesan sementara agar tampilan konsisten dengan DB (tidak menyimpan chat gagal)
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId)
        );
        setInput(trimmed);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menerima balasan AI. Silakan coba lagi.'
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [currentUser?.full_name, getAuthHeaders, isStreaming]
  );

  const handleClearChat = async () => {
    if (isClearing || isStreaming) return;
    try {
      setIsClearing(true);
      setErrorMsg(null);
      const headers = await getAuthHeaders(false);
      const res = await fetch('/api/ai/chat', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal membersihkan riwayat obrolan.');
      }
      setMessages([]);
      setConfirmClear(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membersihkan riwayat obrolan.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Sembunyikan jika di halaman publik/superadmin/invoice atau belum login sebagai user sekolah
  if (
    shouldHide ||
    !authChecked ||
    !currentUser ||
    currentUser.role === 'superadmin' ||
    !currentUser.school_id
  ) {
    return null;
  }

  return (
    <div className="print:hidden">
      {/* Tombol Mengambang (Floating Action Button) */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleOpenChat}
          aria-label="Buka Kakak Pembina AI"
          title="Tanya Kakak Pembina AI"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 group flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-xl shadow-indigo-300/60 transition-all duration-200 active:scale-95 cursor-pointer border border-indigo-400/40"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <span className="text-base leading-none" aria-hidden="true">
            ⚜️
          </span>
          <span className="text-xs font-extrabold tracking-tight pr-0.5">
            Kakak Pembina AI
          </span>
        </button>
      )}

      {/* Jendela Live Chat Responsif */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Live Chat Kakak Pembina AI"
          className={`fixed inset-x-2 bottom-20 h-[78vh] sm:inset-auto sm:right-6 sm:bottom-6 z-50 flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'sm:w-[680px] lg:w-[760px] sm:h-[84vh] max-h-[88vh]'
              : 'sm:w-[480px] md:w-[540px] sm:h-[660px] max-h-[86vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-indigo-600 text-white px-4 py-3.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-lg shrink-0">
                ⚜️
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black leading-tight truncate">
                  Kakak Pembina AI
                </h2>
                <p className="text-[11px] text-indigo-100 truncate">
                  {currentUser.school?.name || 'Asisten Pembina Pramuka'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && !confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={isStreaming}
                  title="Bersihkan riwayat chat sekolah"
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-50 transition cursor-pointer"
                >
                  🗑️
                </button>
              )}

              {confirmClear && (
                <div className="flex items-center gap-1 bg-white/15 rounded-xl px-2 py-1">
                  <button
                    type="button"
                    onClick={handleClearChat}
                    disabled={isClearing}
                    className="text-[10px] font-extrabold bg-rose-500 hover:bg-rose-600 text-white px-2 py-0.5 rounded-lg transition cursor-pointer"
                  >
                    {isClearing ? '...' : 'Hapus'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="text-[10px] font-bold text-indigo-100 hover:text-white px-1 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-label={isExpanded ? 'Perkecil jendela chat' : 'Perbesar jendela chat'}
                title={isExpanded ? 'Ukuran normal' : 'Perbesar jendela chat'}
                className="hidden sm:flex w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                {isExpanded ? '🗗' : '⛶'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmClear(false);
                  setIsOpen(false);
                }}
                aria-label="Tutup jendela chat"
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Area Pesan */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-slate-50">
            {isLoadingHistory ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                <span className="animate-spin text-xl">⏳</span>
                <p className="text-xs font-semibold">Memuat riwayat obrolan...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-4 space-y-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👋</span>
                    <p className="text-xs font-extrabold text-slate-800">
                      Salam Pramuka, Kak {currentUser.full_name.split(' ')[0]}!
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Saya <strong>Kakak Pembina AI</strong>. Siap membantu menyusun ide latihan rutin, permainan regu, kisi-kisi SKU/SKK, PBB, upacara, hingga sandi &amp; semaphore.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Riwayat obrolan ini dapat dilihat bersama oleh pembina di pangkalan Anda.
                  </p>
                </div>

                {/* Quick Prompts (saat chat kosong) */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-500 px-1">
                    Mulai cepat dengan pertanyaan populer:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_PROMPTS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        disabled={isStreaming}
                        onClick={() => sendMessage(item.prompt)}
                        className="text-left p-2.5 rounded-2xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700 hover:text-indigo-700 transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        ✨ {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const isLastAssistantStreaming =
                    !isUser && isStreaming && index === messages.length - 1;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 px-1 mb-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {isUser ? msg.user_name || 'Pembina' : 'Kakak Pembina AI'}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>

                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] shadow-xs ${
                          isUser
                            ? 'bg-indigo-600 text-white rounded-tr-sm whitespace-pre-wrap break-words leading-relaxed'
                            : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-sm'
                        }`}
                      >
                        {isUser ? (
                          msg.content
                        ) : msg.content ? (
                          <div>
                            <FormattedAssistantMessage content={msg.content} />
                            {isLastAssistantStreaming && (
                              <span
                                aria-hidden="true"
                                className="inline-block w-1.5 h-3.5 bg-indigo-500 ml-1 align-middle animate-pulse rounded-xs"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 py-0.5 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                            <span className="text-[11px] font-medium ml-1">Mengetik...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-3 py-2 text-[11px] font-semibold flex items-start justify-between gap-2">
                <span>⚠️ {errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Ringkas di atas input saat sudah ada obrolan */}
          {messages.length > 0 && (
            <div className="px-3.5 pt-2.5 pb-1.5 bg-white border-t border-slate-100 flex flex-wrap items-center gap-1.5 shrink-0">
              {QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => sendMessage(item.prompt)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 transition cursor-pointer disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="p-3.5 bg-white border-t border-slate-100 shrink-0"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  rows={5}
                  value={input}
                  maxLength={MAX_CHARS}
                  disabled={isStreaming}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tanya materi, game, SKU, atau upacara... (Enter untuk kirim, Shift+Enter untuk baris baru)"
                  className="w-full resize-y min-h-[124px] max-h-52 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                />
                {input.length > 800 && (
                  <span className="absolute right-2.5 bottom-1 text-[9px] font-bold text-slate-400">
                    {input.length}/{MAX_CHARS}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                aria-label="Kirim pesan"
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-extrabold px-4 py-2.5 rounded-2xl transition shadow-sm shrink-0 cursor-pointer"
              >
                {isStreaming ? '...' : 'Kirim'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
