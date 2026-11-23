import { GoogleGenAI } from '@google/genai';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// // 1. Fungsi Panggil Groq (Dengan Instruksi JSON yang Lebih Tegas)
// async function callGroq(prompt: string) {
//   const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       model: 'openai/gpt-oss-20b',
//       messages: [
//         { 
//           role: 'system', 
//           content: 'Anda adalah generator JSON murni. JANGAN BERIKAN TEKS ATAU PENJELASAN APA PUN di luar format JSON. Output Anda harus valid murni berupa struktur JSON (Array [...] atau Object {...}).' 
//         },
//         { role: 'user', content: prompt }
//       ],
//       response_format: { type: 'json_object' },
//       temperature: 0.3, // Diturunkan sedikit agar model lebih disiplin mengikuti format
//     }),
//   });

//   if (!response.ok) {
//     const errorData = await response.json();
//     throw new Error(`Groq Limit/Error: ${errorData.error?.message || response.status}`);
//   }

//   const data = await response.json();
//   let content = data.choices[0].message.content;

//   // Bersihkan jaga-jaga kalau masih ada pembungkus markdown backticks
//   content = content.trim();
//   if (content.startsWith('```json')) {
//     content = content.replace(/^```json/, '').replace(/```$/, '').trim();
//   } else if (content.startsWith('```')) {
//     content = content.replace(/^```/, '').replace(/```$/, '').trim();
//   }

//   return content;
// }

// 2. Fungsi Panggil Model Gemini Khusus Teks
async function callGeminiModel(prompt: string, modelName: string) {
  const response = await gemini.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  return response?.text || '';
}

// 3. Rantai Fallback Berlapis (Groq ➡️ Sederetan Model Teks Gemini Terbaik)
export async function generateWithAI(prompt: string) {
  let rawTextResult = '';
  let providerUsed = '';

  const geminiTextFallbackChain = [
    // 'models/gemini-2.5-flash',
    // 'models/gemini-3.8-flash',
    'models/gemini-3.7-flash',
    'models/gemini-3.6-flash',
    'models/gemini-3.5-flash',
    'models/gemini-3-flash-preview',
    'models/gemini-3.1-flash-lite',
    'models/gemini-flash-latest',
    'models/gemini-2.5-pro',
  ];

//   // LANGKAH 1: Coba Groq dulu
//   try {
//     console.log('Mencoba via Groq (gpt-oss-20b)...');
//     rawTextResult = await callGroq(prompt);
//     providerUsed = 'Groq (GPT OSS 20B)';
//     return { rawTextResult, providerUsed };
//   } catch (groqErr: any) {
//     console.warn(`Groq gagal: ${groqErr.message}. Memulai rantai fallback Gemini...`);
//   }

  // LANGKAH 2: Iterasi mencoba satu per satu model teks Gemini
  for (const modelName of geminiTextFallbackChain) {
    try {
      console.log(`Mencoba via ${modelName}...`);
      rawTextResult = await callGeminiModel(prompt, modelName);
      providerUsed = `Gemini (${modelName})`;
      return { rawTextResult, providerUsed };
    } catch (modelErr: any) {
      console.warn(`${modelName} gagal/limit: ${modelErr.message}. Melanjutkan ke model berikutnya...`);
    }
  }

  throw new Error('Semua jalur AI teks (Groq dan seluruh cadangan model Gemini) sedang mengalami limit/gangguan. Silakan coba beberapa saat lagi.');
}