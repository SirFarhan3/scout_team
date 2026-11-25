'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { AttendanceRecord } from '@/types/attendance';

interface NativeQrScannerProps {
  onScanSuccess: (decodedText: string) => Promise<void> | void;
  processing: boolean;
  scanError: string | null;
  lastScannedResult: AttendanceRecord | null;
}

const DECODE_INTERVAL_MS = 150;
const MAX_DECODE_WIDTH = 640;
const SCAN_COOLDOWN_MS = 1500;

export default function NativeQrScanner({
  onScanSuccess,
  processing,
  scanError,
  lastScannedResult,
}: NativeQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onScanSuccessRef = useRef(onScanSuccess);
  const isProcessingRef = useRef(false);
  const isCooldownRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    isProcessingRef.current = processing;
  }, [processing]);

  const handleDetectedCode = useCallback(async (code: string) => {
    if (isProcessingRef.current || isCooldownRef.current) return;

    isCooldownRef.current = true;
    try {
      await onScanSuccessRef.current(code);
    } finally {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      cooldownTimerRef.current = setTimeout(() => {
        isCooldownRef.current = false;
      }, SCAN_COOLDOWN_MS);
    }
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setErrorMessage(null);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');

        try {
          await video.play();
          setCameraActive(true);
        } catch (playError: unknown) {
          if (playError instanceof Error && playError.name !== 'AbortError') {
            console.error('Video play interrupted:', playError);
          }
        }
      }
    } catch (err: unknown) {
      console.error('Camera Access Error:', err);
      setErrorMessage(
        'Izin kamera belum diberikan atau terblokir. Silakan izinkan akses kamera di ikon gembok browser.'
      );
    }
  }, []);

  useEffect(() => {
    let animId = 0;
    let lastDecodeAt = 0;
    const videoEl = videoRef.current;

    const startTimer = setTimeout(() => {
      void initCamera();
    }, 0);

    const processFrame = (now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Skip decode saat sedang memproses/cooldown & throttle ke ~6-7 FPS agar main thread tidak lag
      if (
        !isProcessingRef.current &&
        !isCooldownRef.current &&
        now - lastDecodeAt >= DECODE_INTERVAL_MS &&
        video &&
        canvas &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        video.videoWidth > 0
      ) {
        lastDecodeAt = now;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
          const targetWidth = Math.max(1, Math.round(video.videoWidth * scale));
          const targetHeight = Math.max(1, Math.round(video.videoHeight * scale));

          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
          }

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (qrCode?.data?.trim()) {
            void handleDetectedCode(qrCode.data.trim());
          }
        }
      }

      animId = requestAnimationFrame(processFrame);
    };

    animId = requestAnimationFrame(processFrame);

    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(animId);
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoEl.srcObject = null;
      }
    };
  }, [initCamera, handleDetectedCode]);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          📷 Kamera Scanner
        </h2>
        {processing && (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full animate-pulse">
            Memproses Presensi...
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-slate-950 w-full min-h-[300px] max-h-[360px] flex items-center justify-center border border-slate-200">
        <video
          ref={videoRef}
          className="w-full h-full object-cover min-h-[300px]"
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-indigo-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
            </div>
          </div>
        )}

        {!cameraActive && !errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-3 p-4">
            <span className="animate-spin text-3xl">📷</span>
            <span className="text-xs font-semibold">Menyiapkan Kamera...</span>
            <button
              type="button"
              onClick={initCamera}
              className="mt-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow"
            >
              Nyalakan Kamera
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-rose-400 gap-2">
            <span className="text-xl">⚠️</span>
            <p className="text-xs font-bold leading-relaxed">{errorMessage}</p>
            <button
              type="button"
              onClick={initCamera}
              className="mt-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow"
            >
              Coba Lagi
            </button>
          </div>
        )}
      </div>

      {scanError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
          <span>⚠️</span> {scanError}
        </div>
      )}

      {lastScannedResult && !scanError && (
        lastScannedResult.alreadyRecorded ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-800 px-2.5 py-0.5 rounded-full">
                Sudah Hadir Hari Ini ⚠️
              </span>
              <span className="text-xs font-mono font-bold text-amber-800">
                Pukul {new Date(lastScannedResult.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </span>
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              {lastScannedResult.student?.full_name}
            </h3>
            <p className="text-xs text-amber-800 font-medium">
              Kelas {lastScannedResult.student?.class_name} • {lastScannedResult.student?.group_name}
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-100/70 px-3 py-1.5 rounded-xl font-medium">
              ℹ️ Anggota ini sudah tercatat hadir hari ini. Tidak ada data duplikat yang disimpan ke database.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded">
                {lastScannedResult.isOfflinePending ? 'Tersimpan Offline! 📥' : 'Berhasil Presensi! ✅'}
              </span>
              <span className="text-xs font-mono font-bold">
                {new Date(lastScannedResult.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </span>
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              {lastScannedResult.student?.full_name}
            </h3>
            <p className="text-xs text-emerald-700 font-medium">
              Kelas {lastScannedResult.student?.class_name} • {lastScannedResult.student?.group_name}
            </p>
          </div>
        )
      )}
    </div>
  );
}
