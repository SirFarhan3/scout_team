import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { assertSameOriginMutation, sanitizePromptField } from '@/lib/serverSecurity';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { handleApiError, requireAuth } from '@/lib/authServer';

const omniClient = new OpenAI({
  baseURL: process.env.OMNI_BASE_URL || 'http://localhost:20128/v1',
  apiKey: process.env.OMNI_API_KEY || 'not-needed',
});

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

    const completion = await omniClient.chat.completions.create({
      model: 'gweb/gemini-3.7-flash',
      messages: [{ role: 'user', content: message }],
    });

    const reply = completion.choices[0]?.message?.content || '';
    return NextResponse.json({ success: true, reply });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 402 || error?.status === 403 || error?.status === 400) {
      return handleApiError(error);
    }
    console.error('OmniRoute Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Layanan AI sedang tidak tersedia. Silakan coba beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}
