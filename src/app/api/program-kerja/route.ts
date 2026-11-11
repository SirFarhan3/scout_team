import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tahunAjaran, golongan, namaPangkalan, focus, customPrompt } = body;

    const prompt = `
      Bertindaklah sebagai Pelatih Kepala Pramuka yang ahli dalam menyusun jadwal latihan rutin mingguan.
      Buatkan rancangan jadwal atau program kegiatan berdasarkan parameter berikut:
      - Tahun Ajaran: ${tahunAjaran}
      - Golongan: ${golongan}
      - Nama Pangkalan: ${namaPangkalan}
      - Fokus Utama: ${focus}
      - Catatan Tambahan: ${customPrompt || 'Tidak ada'}

      ATURAN UTAMA STRUKTUR WAKTU PER PEKAN (Total Durasi 2 Jam / 120 Menit):
      Setiap pekan/pertemuan harus dijabarkan ke dalam baris-baris kegiatan dengan format durasi per 15 menit sebagai berikut:
      1. 00.00 - 00.15 -- Upacara Pembukaan (Standar)
      2. 00.15 - 01.30 -- Dipecah menjadi 1 sampai 3 kegiatan inti materi (terserah AI menyesuaikan fokus dan inputan, misal: 00.15 - 00.45, 00.45 - 01.10, dsb, atau satu blok materi utama).
      3. 01.30 - 01.45 -- Istirahat / Sholat / Persiapan
      4. 01.45 - 02.00 -- Upacara Penutupan

      Berikan hasil dalam format JSON array murni (tanpa markdown backticks tambahan jika bisa, atau pastikan format JSON valid) dengan struktur objek sebagai berikut:
      [
        {
          "pekan_ke": "Pekan 1",
          "durasi": "00.00 - 00.15",
          "keterangan_kegiatan": "Upacara Pembukaan Latihan"
        },
        {
          "pekan_ke": "Pekan 1",
          "durasi": "00.15 - 00.45",
          "keterangan_kegiatan": "Materi Inti 1: Penyampaian SKU / Teori"
        },
        ... (lanjutkan sampai Pekan 1 selesai penutupan, lalu buat untuk beberapa pekan berikutnya, misal Pekan 2, Pekan 3, dst).
      ]
      Buatkan untuk beberapa pekan latihan rutin yang padat dan sistematis.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const textResponse = response.text ?? '';
    let cleanJsonStr = textResponse.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const generatedActivities = JSON.parse(cleanJsonStr);

    return NextResponse.json({ success: true, kegiatan: generatedActivities });
  } catch (error: any) {
    console.error('Error generating proker:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghasilkan program kerja dari AI.' },
      { status: 500 }
    );
  }
}