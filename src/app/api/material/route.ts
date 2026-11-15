import { NextResponse } from 'next/server';
import { generateWithAI } from '@/lib/aiService';

export async function POST(request: Request) {
  try {
    const { topic, level, duration } = await request.json();

    if (!topic) {
      return NextResponse.json({ success: false, error: 'Topik latihan wajib diisi' }, { status: 400 });
    }

    const prompt = `Bertindaklah sebagai Pembina Pramuka Ahli dan Pelatih Pembina Mahir. 
    Buatkan rancangan materi latihan kepramukaan untuk golongan ${level || 'Penggalang'} dengan durasi ${duration || '2 Jam'} mengenai topik: "${topic}".
    
    Berikan respons HANYA dalam format JSON murni dengan struktur berikut tanpa teks tambahan di luar JSON:
    {
      "title": "Judul materi yang menarik dan baku",
      "category": "Kategori materi (contoh: Keterampilan / Pengetahuan / P3K / Pionering)",
      "description": "Rancangan lengkap yang terdiri dari: \\n📌 A. RUN-DOWN PERTEMUAN (rincian waktu dari pembukaan, inti, hingga penutupan).\\n\\n📖 B. DETAIL MATERI & TEORI (penjelasan teori, langkah-langkah praktik di lapangan, dan tips untuk pembina).",
      "equipment": [
        { "name": "Nama Alat 1", "isMandatory": true },
        { "name": "Nama Alat 2", "isMandatory": false }
      ]
    }`;

    // Panggil helper AI kita dengan fitur fallback otomatis
    const { rawTextResult, providerUsed } = await generateWithAI(prompt);

    const cleanJsonText = rawTextResult
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsedData = JSON.parse(cleanJsonText);

    return NextResponse.json({ 
      success: true, 
      providerUsed, 
      data: parsedData 
    });

  } catch (error: any) {
    console.error('Error AI Generation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal men-generate materi dengan AI' },
      { status: 500 }
    );
  }
}