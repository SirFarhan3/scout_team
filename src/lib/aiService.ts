export function getOmniAiConfig() {
  const rawBaseUrl = (
    process.env.AI_BASE_URL ||
    process.env.OMNI_BASE_URL ||
    'http://127.0.0.1:20128/v1'
  )
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '');

  // Paksa localhost -> 127.0.0.1 untuk mencegah error "fetch failed" akibat resolusi IPv6 (::1) di Node.js
  const baseURL = rawBaseUrl.replace(/\/\/localhost(?=[:/]|$)/i, '//127.0.0.1');

  const apiKey = (
    process.env.AI_API_KEY ||
    process.env.OMNI_API_KEY ||
    ''
  )
    .trim()
    .replace(/^['"]|['"]$/g, '');

  const rawModel = (
    process.env.AI_MODEL ||
    process.env.OMNI_MODEL ||
    'ai-gratis'
  )
    .trim()
    .replace(/^['"]|['"]$/g, '');

  // Tolak model bawaan "auto/*" atau "ai-free" dan gunakan combo custom "ai-gratis"
  const model =
    !rawModel || /^auto\//i.test(rawModel) || rawModel === 'ai-free'
      ? 'ai-gratis'
      : rawModel;

  return { baseURL, apiKey, model };
}

/**
 * Membersihkan respons AI dari tag <think>...</think> atau pembungkus markdown ```json ... ```
 * agar siap di-parse oleh JSON.parse().
 */
export function extractCleanJsonText(rawText: string): string {
  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endChar = ']';
  }

  if (startIdx !== -1 && endChar) {
    const endIdx = cleaned.lastIndexOf(endChar);
    if (endIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, endIdx + 1);
    }
  }

  return cleaned.trim();
}

export async function callOmniChatCompletion(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
}): Promise<{ content: string; modelUsed: string }> {
  const { baseURL, apiKey, model } = getOmniAiConfig();
  const endpoint = `${baseURL}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.3,
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string } | string;
    } | null;

    if (!res.ok) {
      const errMsg =
        typeof data?.error === 'string'
          ? data.error
          : data?.error?.message || `HTTP ${res.status}`;
      console.error('[OmniRoute HTTP Error]', {
        endpoint,
        model,
        status: res.status,
        error: errMsg,
      });
      throw new Error(`OmniRoute (${model}) gagal [${res.status}]: ${errMsg}`);
    }

    const content = data?.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
      throw new Error(`Respons OmniRoute untuk combo "${model}" kosong.`);
    }

    return {
      content,
      modelUsed: data?.model || model,
    };
  } catch (err: unknown) {
    const errorObj = err as Error & { cause?: unknown };
    const msg = errorObj?.message || String(err);
    const causeDetail =
      errorObj?.cause instanceof Error
        ? `${errorObj.cause.message} (${(errorObj.cause as Error & { code?: string }).code || 'NO_CODE'})`
        : errorObj?.cause
        ? JSON.stringify(errorObj.cause)
        : undefined;

    console.error('[OmniRoute Fetch Error]', {
      endpoint,
      model,
      hasApiKey: Boolean(apiKey),
      message: msg,
      cause: errorObj?.cause || null,
    });

    throw new Error(
      `Gagal memanggil OmniRoute (${model} @ ${endpoint}): ${msg}${
        causeDetail ? ` | Cause: ${causeDetail}` : ''
      }`
    );
  }
}

/**
 * Generator JSON utama untuk Materi & Program Kerja via OmniRoute (combo: "ai-gratis").
 */
export async function generateWithAI(prompt: string): Promise<{
  rawTextResult: string;
  providerUsed: string;
}> {
  const { content, modelUsed } = await callOmniChatCompletion({
    messages: [
      {
        role: 'system',
        content:
          'Anda adalah generator JSON murni untuk sistem manajemen kepramukaan. JANGAN berikan teks pengantar, penjelasan, atau markdown di luar format JSON. Output Anda harus 100% valid JSON (Object {...} atau Array [...]).',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
  });

  const rawTextResult = extractCleanJsonText(content);
  if (!rawTextResult) {
    throw new Error('Respons dari OmniRoute kosong.');
  }

  return {
    rawTextResult,
    providerUsed: `OmniRoute (${modelUsed})`,
  };
}
