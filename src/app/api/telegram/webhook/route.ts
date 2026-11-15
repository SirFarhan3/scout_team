import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Inisialisasi Supabase client (menggunakan Service Role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Helper untuk kirim pesan teks balik ke Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Helper untuk transkripsi audio pakai Whisper (Groq Whisper API)
async function transcribeAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
  const formData = new FormData();
  
  // Konversi Buffer ke Uint8Array agar lolos validasi tipe BlobPart TypeScript[cite: 1]
  const uint8Array = new Uint8Array(audioBuffer);
  const blob = new Blob([uint8Array], { type: 'audio/ogg' });
  
  formData.append('file', blob, fileName);
  formData.append('model', 'whisper-large-v3');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal transkripsi audio via Whisper: ${errText}`);
  }

  const data = await response.json();
  return data.text;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Pastikan ada pesan masuk dari Telegram
    const message = body.message;
    if (!message) return NextResponse.json({ status: 'ok' });

    const chatId = message.chat.id;
    let transcribedText = '';

    // 1. Tangani Voice Note atau Audio File dari Telegram
    if (message.voice || message.audio) {
      const fileId = message.voice ? message.voice.file_id : message.audio.file_id;
      const token = process.env.TELEGRAM_BOT_TOKEN;

      const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      const filePath = fileData.result.file_path;

      const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
      const arrayBuffer = await downloadRes.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      transcribedText = await transcribeAudio(audioBuffer, 'voice_note.ogg');
    } 
    // 2. Tangani Pesan Teks Biasa
    else if (message.text) {
      transcribedText = message.text;
    } else {
      return NextResponse.json({ status: 'ok' });
    }

    // Ambil tanggal hari ini (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    // Cek apakah sudah ada progres log di tabel log_books untuk hari ini[cite: 1]
    const { data: existingLog } = await supabase
      .from('log_books')
      .select('*')
      .eq('tanggal', today)
      .single();

    const currentKegiatan = existingLog && existingLog.kegiatan ? existingLog.kegiatan : {};

    // 3. Analisis menggunakan Gemini Flash untuk ekstrak data & cek parameter bolong
    const prompt = `
    Anda adalah asisten AI pencatat log harian kegiatan Pramuka.
    Analisis kalimat dari pembina berikut: "${transcribedText}"
    
    Data log yang sudah terkumpul sejauh ini di database:
    ${JSON.stringify(currentKegiatan)}

    Parameter wajib yang harus lengkap dicatat:
    1. golongan (contoh: Siaga, Penggalang, Penegak)
    2. materi (topik latihan)
    3. jam_mulai & jam_selesai (contoh: 15:00 - 17:00)
    4. jumlah_hadir (angka)
    5. total_anggota (angka)
    6. catatan (opsional, kendala/situasi cuaca)

    Tugasmu:
    1. Gabungkan informasi baru dari teks pembina ke dalam objek kegiatan yang sudah ada.
    2. Cek parameter wajib apa saja yang MASIH KOSONG atau BELUM DISEBUTKAN.
    3. Berikan output dalam format JSON murni:
    {
      "kegiatan": { ...objek data terbaru setelah digabung... },
      "missing_fields": [ "Sebutkan nama field yang masih kosong, misal: 'golongan', 'jumlah_hadir'" ],
      "reply_message": "Pesan balasan ramah untuk pembina. Jika ada yang kurang, sebutkan secara spesifik apa yang harus dilengkapi. Jika semua parameter wajib sudah terisi lengkap, katakan bahwa log harian berhasil disimpan."
    }
    `;
    console.log("Proses Generate VN")
    const aiResponse = await gemini.models.generateContent({
      model: 'models/gemini-1.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const result = JSON.parse(aiResponse.text || '{}');
    const updatedKegiatan = result.kegiatan || {};
    const missingFields: string[] = result.missing_fields || [];
    const replyMessage = result.reply_message || 'Data diproses.';

    // 4. Simpan progres / hasil akhir ke tabel log_books Supabase (kolom kegiatan jsonb)[cite: 1]
    await supabase.from('log_books').upsert({
      tanggal: today,
      kegiatan: updatedKegiatan
    }, { onConflict: 'tanggal' });

    // 5. Kirim balasan interaktif ke Telegram pembina
    if (missingFields.length > 0) {
      await sendTelegramMessage(chatId, `📝 *Tercatat:* "${transcribedText}"\n\n⚠️ ${replyMessage}`);
    } else {
      await sendTelegramMessage(chatId, `✅ ${replyMessage}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error Telegram Webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}