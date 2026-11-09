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

  const isProcessingRef = useRef(false);
  const isCooldownRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = processing;
  }, [processing]);

  const handleDetectedCode = useCallback(
    async (code: string) => {
      if (isProcessingRef.current || isCooldownRef.current) return;

      isCooldownRef.current = true;
      try {
        await onScanSuccess(code);
      } finally {
        setTimeout(() => {
          isCooldownRef.current = false;
        }, 2500);
      }
    },
    [onScanSuccess]
  );

  const initCamera = useCallback(async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');

        try {
          await videoRef.current.play();
          setCameraActive(true);
        } catch (playError: any) {
          if (playError.name !== 'AbortError') {
            console.error('Video play interrupted:', playError);
          }
        }
      }
    } catch (err: any) {
      console.error('Camera Access Error:', err);
      setErrorMessage(
        'Izin kamera belum diberikan atau terblokir. Silakan izinkan akses kamera di ikon gembok browser.'
      );
    }
  }, []);

  useEffect(() => {
    let animId: number;

    initCamera();

    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        video &&
        canvas &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        video.videoWidth > 0
      ) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (qrCode && qrCode.data) {
            handleDetectedCode(qrCode.data);
          }
        }
      }

      animId = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => {
      cancelAnimationFrame(animId);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
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
        {/* 🚫 Efek mirror (scale-x-[-1]) sudah dihapus agar posisi normal */}
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
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl space-y-1 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded">
              Berhasil Presensi! ✅
            </span>
            <span className="text-xs font-mono font-bold">
              {new Date(lastScannedResult.created_at).toLocaleTimeString('id-ID')}
            </span>
          </div>
          <h3 className="font-extrabold text-base text-slate-900">
            {lastScannedResult.student?.full_name}
          </h3>
          <p className="text-xs text-emerald-700 font-medium">
            Kelas {lastScannedResult.student?.class_name} • {lastScannedResult.student?.group_name}
          </p>
        </div>
      )}
    </div>
  );
}