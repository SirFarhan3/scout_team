import { NextResponse } from 'next/server';
import { callOmniChatCompletion } from '@/lib/aiService';
import { assertSameOriginMutation, sanitizePromptField } from '@/lib/serverSecurity';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { handleApiError, requireAuth } from '@/lib/authServer';

export async function POST(req: Request) {
  try {
    assertSameOriginMutation(req);
    const ctx = await requireAuth({
      roles: ['admin', 'pembina', 'instruktur'],
      requireSchool: true,
      requireActiveSubscription: true,
      requireAiFeature: true,
    });

    const ip = getClientIp(req);
    const limit = checkRateLimit(`ai:chat:${ctx.school!.id}:${ip}`, 20, 10 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Batas penggunaan AI sementara tercapai. Coba beberapa menit lagi.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const message = sanitizePromptField(body?.message, 2000);
    if (!message) {
      return NextResponse.json({ success: false, error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }

    const { content, modelUsed } = await callOmniChatCompletion({
      messages: [{ role: 'user', content: message }],
    });

    return NextResponse.json({
      success: true,
      modelUsed,
      reply: content,
    });
  } catch (error: unknown) {
    const errWithStatus = error as { status?: number; message?: string };
    if (
      errWithStatus?.status === 401 ||
      errWithStatus?.status === 402 ||
      errWithStatus?.status === 403 ||
      errWithStatus?.status === 400
    ) {
      return handleApiError(error);
    }
    console.error('OmniRoute Error:', errWithStatus?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Layanan AI sedang tidak tersedia. Silakan coba beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}
