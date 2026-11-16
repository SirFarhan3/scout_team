import OpenAI from 'openai';
import { isSameOriginRequest, sanitizePromptField } from '@/lib/serverSecurity';

const omniClient = new OpenAI({
  baseURL: process.env.OMNI_BASE_URL || 'http://localhost:20128/v1',
  apiKey: process.env.OMNI_API_KEY || 'not-needed',
});

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return Response.json({ success: false, error: 'Akses lintas origin ditolak.' }, { status: 403 });
    }

    const body = await req.json();
    const message = sanitizePromptField(body?.message, 2000);
    if (!message) {
      return Response.json({ success: false, error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }

    const completion = await omniClient.chat.completions.create({
      model: 'gweb/gemini-3.7-flash',
      messages: [{ role: 'user', content: message }],
    });

    const reply = completion.choices[0]?.message?.content || '';

    return Response.json({ success: true, reply });
  } catch (error: any) {
    // Log detail error hanya di server, jangan bocorkan internal infrastructure detail ke client
    console.error('OmniRoute Error:', error?.message || error);

    return Response.json(
      {
        success: false,
        error: 'Layanan AI sedang tidak tersedia. Silakan coba beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}
