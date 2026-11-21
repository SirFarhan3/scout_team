'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Modal } from 'antd';
import jsQR from 'jsqr';
import { extractQrCodeId } from '@/lib/sanitize';

interface QrCodePickerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (extractedQrId: string, rawText: string) => void;
}

export default function QrCodePickerModal({
  open,
  onClose,
  onDetected,
}: QrCodePickerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const detectedRef = useRef(false);

  const stopMediaTracks = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopMediaTracks();
      return;
    }

    detectedRef.current = false;
    let animId: number;
    let cancelled = false;

    const startCamera = async () => {
      try {
        setErrorMessage(null);
        setCameraActive(false);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          try {
            await videoRef.current.play();
            setCameraActive(true);
          } catch {
            // ignore play interruption
          }
        }
      } catch {
        setErrorMessage(
          'Izin kamera belum diberikan atau terblokir. Izinkan akses kamera di browser atau tempel link secara manual.'
        );
      }
    };

    startCamera();

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        !detectedRef.current &&
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
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data.trim() !== '') {
            const raw = code.data.trim();
            const extracted = extractQrCodeId(raw);
            if (extracted) {
              detectedRef.current = true;
              stopMediaTracks();
              onDetected(extracted, raw);
              return;
            }
          }
        }
      }

      if (!cancelled && !detectedRef.current) {
        animId = requestAnimationFrame(scanFrame);
      }
    };

    animId = requestAnimationFrame(scanFrame);

    return () => {
      cancelled = true;
      if (animId) cancelAnimationFrame(animId);
      stopMediaTracks();
    };
  }, [open, onDetected, stopMediaTracks]);

  return (
    <Modal
      title={
        <div className="text-sm font-bold text-slate-800">
          📷 Scan QR Kartu KTA AyoPramuka / Kartu Anggota
        </div>
      }
      open={open}
      onCancel={() => {
        stopMediaTracks();
        onClose();
      }}
      footer={null}
      centered
      destroyOnHidden
    >
      <div className="space-y-3 pt-2">
        <p className="text-xs text-slate-500">
          Arahkan kamera ke QR Code KTA AyoPramuka
        </p>

        {errorMessage ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-4 rounded-2xl">
            {errorMessage}
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />
            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-white text-xs font-semibold">
                Mengaktifkan kamera...
              </div>
            )}
            <div className="absolute inset-6 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none" />
          </div>
        )}
      </div>
    </Modal>
  );
}
