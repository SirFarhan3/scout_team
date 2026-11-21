'use client';

import React from 'react';

interface PageLoaderProps {
  text?: string;
}

export default function PageLoader({ text = 'Memuat Data...' }: PageLoaderProps) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans p-4">
      <div className="flex items-center gap-3.5 bg-white px-6 py-4 rounded-3xl shadow-lg border border-slate-100">
        <span className="animate-spin text-2xl">⚡</span>
        <span className="text-sm font-bold text-slate-700">{text}</span>
      </div>
    </div>
  );
}
