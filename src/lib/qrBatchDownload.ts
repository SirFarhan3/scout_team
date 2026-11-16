import QRCode from 'qrcode';
import { Student } from '@/types/student';
import { escapeHtml, isSafePngDataUrl } from '@/lib/sanitize';

const COLUMNS = 3;
const ROWS = 4;
const PER_PAGE = COLUMNS * ROWS; // 12 QR per lembar A4

/**
 * Cetak QR anggota dalam satu/lebih lembar A4 (12 QR per halaman: 3 kolom x 4 baris).
 * Dibuka di jendela cetak browser — bisa langsung diprint atau "Save as PDF".
 * Harus dipanggil langsung dari klik user agar pop-up tidak diblokir.
 */
export async function printStudentQrSheet(students: Student[], heading: string): Promise<void> {
  // Buka jendela SEKARANG (sinkron dengan klik) lalu isi setelah QR selesai dibuat
  const win = window.open('', '_blank', 'width=900,height=1000,noopener,noreferrer');
  if (!win) {
    throw new Error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak QR.');
  }
  win.document.write('<p style="font-family:Arial;padding:24px">Menyiapkan lembar QR...</p>');

  try {
    // Buat semua QR sebagai data URL (quiet zone 4 modul agar mudah di-scan)
    const cards = await Promise.all(
      students.map(async (student) => {
        const value = (student.qr_code_id || student.id || '').trim();
        const dataUrl = await QRCode.toDataURL(value, {
          width: 600,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (!isSafePngDataUrl(dataUrl)) {
          throw new Error('Format gambar QR tidak valid.');
        }
        return `
          <div class="card">
            <img src="${dataUrl}" alt="QR ${escapeHtml(student.full_name)}" />
            <div class="name">${escapeHtml(student.full_name)}</div>
            <div class="meta">${escapeHtml(student.class_name || '-')} • ${escapeHtml(student.group_name || '-')}</div>
            <div class="code">${escapeHtml(value)}</div>
          </div>`;
      })
    );

    // Bagi per halaman A4
    const pages: string[] = [];
    for (let i = 0; i < cards.length; i += PER_PAGE) {
      pages.push(`<section class="page">${cards.slice(i, i + PER_PAGE).join('')}</section>`);
    }

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(heading)}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
            .page {
              width: 190mm;
              height: 277mm;
              display: grid;
              grid-template-columns: repeat(${COLUMNS}, 1fr);
              grid-template-rows: repeat(${ROWS}, 1fr);
              page-break-after: always;
              break-after: page;
            }
            .page:last-child { page-break-after: auto; break-after: auto; }
            .card {
              border: 0.3mm dashed #888; /* garis bantu potong */
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              padding: 3mm;
              overflow: hidden;
            }
            .card img { width: 44mm; height: 44mm; image-rendering: pixelated; }
            .name { font-size: 10pt; font-weight: bold; margin-top: 1.5mm; line-height: 1.2; word-break: break-word; }
            .meta { font-size: 8pt; margin-top: 0.8mm; }
            .code { font-size: 7pt; font-family: monospace; margin-top: 0.8mm; color: #333; word-break: break-all; }
          </style>
        </head>
        <body>${pages.join('')}</body>
      </html>
    `);
    win.document.close();

    // Beri waktu gambar ter-render sebelum dialog cetak muncul
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  } catch (error) {
    win.close();
    throw error;
  }
}
