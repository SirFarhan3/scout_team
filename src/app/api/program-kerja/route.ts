import { NextResponse } from 'next/server';
import { generateWithAI } from '@/lib/aiService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tahunAjaran, golongan, namaPangkalan, focus, customPrompt } = body;

    if (!golongan || !tahunAjaran) {
      return NextResponse.json(
        { success: false, message: 'Golongan dan Tahun Ajaran wajib diisi!' },
        { status: 400 }
      );
    }

    const prompt = `
      Bertindaklah sebagai Pelatih Kepala Pramuka yang ahli dalam menyusun jadwal latihan rutin mingguan.
      Buatkan rancangan jadwal atau program kegiatan berdasarkan parameter berikut:
      - Tahun Ajaran: ${tahunAjaran}
      - Golongan: ${golongan}
      - Nama Pangkalan: ${namaPangkalan || 'Gugus Depan'}
      - Fokus Utama: ${focus || 'Umum'}
      - Catatan Tambahan: ${customPrompt || 'Tidak ada'}

      ATURAN UTAMA STRUKTUR WAKTU PER PEKAN (Total Durasi 2 Jam / 120 Menit untuk Latihan Rutin):
      Setiap pekan/pertemuan normal harus dijabarkan ke dalam baris-baris kegiatan dengan format durasi per 15 menit sebagai berikut:
      1. 00.00 - 00.15 -- Upacara Pembukaan
      2. 00.15 - 01.30 -- Dipecah menjadi 1 sampai 3 kegiatan inti materi.
      3. 01.30 - 01.45 -- Istirahat
      4. 01.45 - 02.00 -- Upacara Penutupan

      ATURAN KHUSUS PERKEMAHAN:
      Sertakan 1 pekan khusus untuk kegiatan "Perkemahan" di tengah tahun ajaran dengan durasi "--".

      Berikan hasil HANYA dalam format JSON array murni tanpa markdown backticks tambahan dengan struktur objek:
      [
        {
          "pekan_ke": "Pekan 1",
          "durasi": "00.00 - 00.15",
          "kegiatan": "Upacara Pembukaan Latihan",
          "keterangan_kegiatan": "..."
        }
      ]
      Buatkan total keseluruhan antara 25 sampai 30 pekan pertemuan (termasuk 1 pekan perkemahan).
    `;

    // Panggil helper AI kita (Otomatis coba Groq dulu, kalau limit lari ke Gemini)
    const { rawTextResult, providerUsed } = await generateWithAI(prompt);

    let cleanJsonStr = rawTextResult.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const generatedActivities = JSON.parse(cleanJsonStr);

    return NextResponse.json({ 
      success: true, 
      providerUsed, // Info AI mana yang berhasil mengeksekusi
      kegiatan: generatedActivities 
    });

  } catch (error: any) {
    console.error('Error generating proker:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghasilkan program kerja dari AI.' },
      { status: 500 }
    );
  }
}