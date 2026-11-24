import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { dbAll, dbExec, dbOne, getDb } from '@/lib/turso';
import { handleApiError, requireAuth } from '@/lib/authServer';
import { assertSameOriginMutation } from '@/lib/serverSecurity';
import { containsDangerousCode } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_FETCH_LIMIT = 30;
const CONTEXT_HISTORY_LIMIT = 12;
const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-3.1-flash-live-preview';
const LIVE_SESSION_TIMEOUT_MS = 45_000;

interface AiChatMessageRow {
  id: string;
  school_id: string;
  user_id: string | null;
  user_name: string | null;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

function buildSystemInstruction(params: {
  schoolName: string;
  gugusdepan?: string | null;
  city?: string | null;
  golongan?: string | null;
  pembinaName: string;
}): string {
  const schoolInfoParts = [
    `Pangkalan/Sekolah: ${params.schoolName}`,
    params.gugusdepan ? `Gugusdepan: ${params.gugusdepan}` : null,
    params.city ? `Kota/Wilayah: ${params.city}` : null,
    params.golongan ? `Golongan Pramuka: ${params.golongan}` : null,
  ].filter(Boolean);

  return [
    'Kamu adalah "Kakak Pembina AI", asisten virtual resmi untuk para Pembina Pramuka di Indonesia.',
    'Karakter & Gaya Bahasa:',
    '- Ramah, antusias, praktis, suportif, dan menggunakan sapaan khas Pramuka ("Kak" atau sesekali "Kakak").',
    '- Menguasai pedoman Kwartir Nasional (Kwarnas) Gerakan Pramuka: SKU/SKK, PBB (Peraturan Baris-Berbaris), sandi-sandi (Morse, Kotak, Rumput, AN/AZ, dll.), semaphore, tali-temali/pionering, tata upacara latihan, serta ide permainan/ice breaking latihan rutin.',
    '- Jawab secara terstruktur dengan poin-poin ringkas, jelas, dan langsung bisa dipraktikkan di lapangan (hindari paragraf yang terlalu panjang bertele-tele).',
    '- Gunakan Bahasa Indonesia yang natural dan sopan.',
    '',
    'Konteks Pangkalan Saat Ini:',
    ...schoolInfoParts.map((line) => `- ${line}`),
    `- Pembina yang sedang bertanya: Kak ${params.pembinaName}`,
    '',
    'Catatan Penting:',
    '- Sesuaikan saran permainan, materi, dan tingkat kesulitan dengan golongan pangkalan jika tersedia (jika belum disebutkan, berikan opsi singkat atau asumsikan sesuai konteks pertanyaan).',
    '- Jika pertanyaan di luar topik kepramukaan atau pembinaan peserta didik, tetap tanggapi dengan sopan dan arahkan kembali secara halus ke konteks kegiatan Pramuka/sekolah.',
  ].join('\n');
}

/**
 * GET /api/ai/chat
 * Mengambil 30 riwayat pesan terakhir milik sekolah yang sedang login (urut kronologis).
 */
export async function GET() {
  try {
    const ctx = await requireAuth({
      roles: ['admin', 'pembina', 'instruktur'],
      requireSchool: true,
    });

    const rows = await dbAll<AiChatMessageRow>(
      `SELECT id, school_id, user_id, user_name, role, content, created_at
       FROM (
         SELECT id, school_id, user_id, user_name, role, content, created_at
         FROM ai_chat_messages
         WHERE school_id = ?
         ORDER BY created_at DESC
         LIMIT ?
       )
       ORDER BY created_at ASC`,
      [ctx.school!.id, HISTORY_FETCH_LIMIT]
    );

    const messages = rows.map((row) => ({
      id: String(row.id),
      school_id: String(row.school_id),
      user_id: row.user_id ? String(row.user_id) : null,
      user_name: row.user_name ? String(row.user_name) : null,
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: String(row.content),
      created_at: String(row.created_at),
    }));

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * POST /api/ai/chat
 * Mengirim pesan ke Gemini 3.1 Flash Live (gemini-3.1-flash-live-preview) melalui Gemini Live API
 * dan melakukan streaming teks secara real-time ke client via ReadableStream.
 * Pesan user dan balasan asisten HANYA disimpan ke DB jika sesi Live selesai sukses & tidak kosong.
 */
export async function POST(req: Request) {
  try {
    assertSameOriginMutation(req);

    const ctx = await requireAuth({
      roles: ['admin', 'pembina', 'instruktur'],
      requireSchool: true,
    });

    const body = await req.json().catch(() => null);
    const rawMessage = typeof body?.message === 'string' ? body.message : '';
    const cleanMessage = rawMessage.replace(/\r\n/g, '\n').trim();

    if (!cleanMessage) {
      return NextResponse.json(
        { success: false, error: 'Pesan tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
        },
        { status: 400 }
      );
    }

    if (containsDangerousCode(cleanMessage)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pesan ditolak karena mengandung tag HTML atau skrip berbahaya.',
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error('[AI CHAT] GEMINI_API_KEY belum dikonfigurasi di environment server.');
      return NextResponse.json(
        {
          success: false,
          error: 'Layanan Kakak Pembina AI belum dikonfigurasi (GEMINI_API_KEY belum diatur).',
        },
        { status: 500 }
      );
    }

    const school = ctx.school!;
    const schoolId = school.id;

    // Ambil golongan terbaru dari program_kerja (jika ada) dan riwayat obrolan terakhir secara paralel
    const [latestProker, recentRows] = await Promise.all([
      dbOne<{ golongan?: string }>(
        `SELECT golongan
         FROM program_kerja
         WHERE school_id = ? AND TRIM(golongan) != ''
         ORDER BY created_at DESC
         LIMIT 1`,
        [schoolId]
      ).catch(() => null),
      dbAll<Pick<AiChatMessageRow, 'role' | 'content'>>(
        `SELECT role, content
         FROM (
           SELECT role, content, created_at
           FROM ai_chat_messages
           WHERE school_id = ?
           ORDER BY created_at DESC
           LIMIT ?
         )
         ORDER BY created_at ASC`,
        [schoolId, CONTEXT_HISTORY_LIMIT]
      ),
    ]);

    const systemInstruction = buildSystemInstruction({
      schoolName: school.name,
      gugusdepan: school.gugusdepan,
      city: school.city,
      golongan: latestProker?.golongan ? String(latestProker.golongan) : null,
      pembinaName: ctx.user.full_name,
    });

    const turns = [
      ...recentRows.map((row) => ({
        role: row.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(row.content) }],
      })),
      {
        role: 'user',
        parts: [{ text: cleanMessage }],
      },
    ];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1beta' },
    });

    const userCreatedAtMs = Date.now();
    const userCreatedAt = new Date(userCreatedAtMs).toISOString();
    const encoder = new TextEncoder();

    let activeSession: Session | null = null;
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const cleanupSession = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (activeSession) {
        try {
          activeSession.close();
        } catch {
          // Abaikan jika WebSocket sudah tertutup
        }
        activeSession = null;
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullReply = '';
        let promptSent = false;
        let receivedOutputTranscription = false;

        const saveAndClose = async () => {
          if (settled) return;
          settled = true;
          cleanupSession();

          const trimmedReply = fullReply.trim();
          if (trimmedReply.length > 0) {
            try {
              const assistantCreatedAt = new Date(
                Math.max(Date.now(), userCreatedAtMs + 1)
              ).toISOString();

              const db = await getDb();
              await db.batch(
                [
                  {
                    sql: `INSERT INTO ai_chat_messages (id, school_id, user_id, user_name, role, content, created_at)
                          VALUES (?, ?, ?, ?, 'user', ?, ?)`,
                    args: [
                      crypto.randomUUID(),
                      schoolId,
                      ctx.user.id,
                      ctx.user.full_name,
                      cleanMessage,
                      userCreatedAt,
                    ],
                  },
                  {
                    sql: `INSERT INTO ai_chat_messages (id, school_id, user_id, user_name, role, content, created_at)
                          VALUES (?, ?, NULL, 'Kakak Pembina AI', 'assistant', ?, ?)`,
                    args: [
                      crypto.randomUUID(),
                      schoolId,
                      trimmedReply,
                      assistantCreatedAt,
                    ],
                  },
                ],
                'write'
              );
            } catch (dbErr) {
              console.error('[AI CHAT DB SAVE ERROR]', dbErr);
            }
          }

          try {
            controller.close();
          } catch {
            // Stream sudah ditutup
          }
        };

        const failStream = (err: unknown) => {
          if (settled) return;
          settled = true;
          cleanupSession();
          console.error('[AI CHAT LIVE STREAM ERROR]', err);
          try {
            controller.error(
              err instanceof Error ? err : new Error('Koneksi Gemini Live API terputus.')
            );
          } catch {
            // Stream sudah ditutup
          }
        };

        const sendPromptIfReady = () => {
          if (promptSent || settled || !activeSession) return;
          promptSent = true;
          try {
            activeSession.sendClientContent({
              turns,
              turnComplete: true,
            });
          } catch (sendErr) {
            failStream(sendErr);
          }
        };

        timeoutHandle = setTimeout(() => {
          if (!settled) {
            if (fullReply.trim().length > 0) {
              void saveAndClose();
            } else {
              failStream(new Error('Waktu tunggu respons Gemini Live API habis.'));
            }
          }
        }, LIVE_SESSION_TIMEOUT_MS);

        try {
          activeSession = await ai.live.connect({
            model: GEMINI_LIVE_MODEL,
            config: {
              // gemini-3.1-flash-live-preview adalah model native-audio Live API:
              // gunakan AUDIO + outputAudioTranscription agar transkrip teks mengalir stabil real-time.
              responseModalities: [Modality.AUDIO],
              outputAudioTranscription: {},
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              temperature: 0.7,
            },
            callbacks: {
              onmessage: (serverMessage: LiveServerMessage) => {
                if (settled) return;

                if (serverMessage.setupComplete) {
                  sendPromptIfReady();
                }

                const serverContent = serverMessage.serverContent;
                if (serverContent) {
                  // 1. Transkrip teks real-time dari output audio Gemini 3.1 Flash Live
                  const transcriptChunk = serverContent.outputTranscription?.text;
                  if (transcriptChunk) {
                    receivedOutputTranscription = true;
                    fullReply += transcriptChunk;
                    controller.enqueue(encoder.encode(transcriptChunk));
                  } else if (
                    !receivedOutputTranscription &&
                    serverContent.modelTurn?.parts?.length
                  ) {
                    // 2. Fallback untuk teks non-thought apabila model mengirimkan text parts langsung
                    for (const part of serverContent.modelTurn.parts) {
                      if (!part.thought && typeof part.text === 'string' && part.text) {
                        fullReply += part.text;
                        controller.enqueue(encoder.encode(part.text));
                      }
                    }
                  }

                  if (serverContent.turnComplete) {
                    void saveAndClose();
                  }
                }
              },
              onerror: (errEvent) => {
                failStream(
                  new Error(errEvent?.message || 'Terjadi kesalahan pada sesi Gemini Live API.')
                );
              },
              onclose: (closeEvent) => {
                if (settled) return;
                if (fullReply.trim().length > 0 && (!closeEvent?.code || closeEvent.code === 1000)) {
                  void saveAndClose();
                } else {
                  const reason = closeEvent?.reason || `code ${closeEvent?.code ?? 'unknown'}`;
                  failStream(new Error(`Sesi Gemini Live API ditutup sebelum selesai (${reason}).`));
                }
              },
            },
          });

          // Jika setupComplete sudah diterima sebelum connect() selesai resolve
          if (activeSession.setupComplete) {
            sendPromptIfReady();
          }
        } catch (connectErr) {
          failStream(connectErr);
        }
      },
      cancel() {
        settled = true;
        cleanupSession();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    const errWithStatus = error as { status?: number; message?: string };
    if (
      errWithStatus?.status === 400 ||
      errWithStatus?.status === 401 ||
      errWithStatus?.status === 402 ||
      errWithStatus?.status === 403
    ) {
      return handleApiError(error);
    }

    console.error('[AI CHAT POST ERROR]', errWithStatus?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Kakak Pembina AI sedang mengalami gangguan. Silakan coba beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/chat
 * Menghapus seluruh riwayat chat milik sekolah yang sedang login untuk memulai obrolan baru.
 */
export async function DELETE(req: Request) {
  try {
    assertSameOriginMutation(req);

    const ctx = await requireAuth({
      roles: ['admin', 'pembina', 'instruktur'],
      requireSchool: true,
    });

    await dbExec('DELETE FROM ai_chat_messages WHERE school_id = ?', [ctx.school!.id]);

    return NextResponse.json({
      success: true,
      message: 'Riwayat obrolan berhasil dibersihkan.',
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
