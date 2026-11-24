const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

function ejaAngka(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num < 12) {
    return SATUAN[num];
  }
  if (num < 20) {
    return `${ejaAngka(num - 10)} Belas`.trim();
  }
  if (num < 100) {
    const puluhan = Math.floor(num / 10);
    const sisa = num % 10;
    return `${ejaAngka(puluhan)} Puluh ${ejaAngka(sisa)}`.trim();
  }
  if (num < 200) {
    return `Seratus ${ejaAngka(num - 100)}`.trim();
  }
  if (num < 1000) {
    const ratusan = Math.floor(num / 100);
    const sisa = num % 100;
    return `${ejaAngka(ratusan)} Ratus ${ejaAngka(sisa)}`.trim();
  }
  if (num < 2000) {
    return `Seribu ${ejaAngka(num - 1000)}`.trim();
  }
  if (num < 1_000_000) {
    const ribuan = Math.floor(num / 1000);
    const sisa = num % 1000;
    return `${ejaAngka(ribuan)} Ribu ${ejaAngka(sisa)}`.trim();
  }
  if (num < 1_000_000_000) {
    const jutaan = Math.floor(num / 1_000_000);
    const sisa = num % 1_000_000;
    return `${ejaAngka(jutaan)} Juta ${ejaAngka(sisa)}`.trim();
  }
  if (num < 1_000_000_000_000) {
    const miliaran = Math.floor(num / 1_000_000_000);
    const sisa = num % 1_000_000_000;
    return `${ejaAngka(miliaran)} Miliar ${ejaAngka(sisa)}`.trim();
  }
  const triliunan = Math.floor(num / 1_000_000_000_000);
  const sisa = num % 1_000_000_000_000;
  return `${ejaAngka(triliunan)} Triliun ${ejaAngka(sisa)}`.trim();
}

export function terbilang(angka: number): string {
  if (!Number.isFinite(angka) || Math.floor(Math.abs(angka)) === 0) {
    return 'Nol';
  }
  const hasil = ejaAngka(angka).replace(/\s+/g, ' ').trim();
  return angka < 0 ? `Minus ${hasil}` : hasil;
}

export function terbilangRupiah(angka: number): string {
  return `${terbilang(angka)} Rupiah`;
}
