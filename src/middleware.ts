import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Izinkan semua request lewat tanpa melakukan redirect otomatis (307)
  return NextResponse.next();
}

// Config matcher dibuat kosong agar middleware tidak mencegat halaman manajemen & scan
export const config = {
  matcher: [],
};