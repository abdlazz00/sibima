import jsQR from 'jsqr';
import { useEffect, useRef } from 'react';

export type ScanError = 'insecure' | 'denied' | 'no-camera' | 'busy' | 'unknown';

interface QrScannerProps {
    onDetect: (text: string) => void;
    onError: (error: ScanError) => void;
}

const MAX_WIDTH = 480;
const REPEAT_MS = 2000;

function errorKind(error: unknown): ScanError {
    switch ((error as DOMException | undefined)?.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'denied';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'no-camera';
        case 'NotReadableError':
            return 'busy';
        default:
            return 'unknown';
    }
}

export default function QrScanner({ onDetect, onError }: QrScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onDetectRef = useRef(onDetect);
    const onErrorRef = useRef(onError);
    onDetectRef.current = onDetect;
    onErrorRef.current = onError;

    useEffect(() => {
        if (!navigator.mediaDevices?.getUserMedia) {
            onErrorRef.current('insecure');
            return;
        }

        let stream: MediaStream | null = null;
        let frame = 0;
        let stopped = false;
        let last = { text: '', at: 0 };

        const tick = () => {
            if (stopped) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
                    const now = Date.now();

                    if (code && code.data && (code.data !== last.text || now - last.at > REPEAT_MS)) {
                        last = { text: code.data, at: now };
                        onDetectRef.current(code.data);
                    }
                }
            }

            frame = requestAnimationFrame(tick);
        };

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
            .then((media) => {
                if (stopped) {
                    media.getTracks().forEach((t) => t.stop());
                    return;
                }
                stream = media;
                const video = videoRef.current;
                if (video) {
                    video.srcObject = media;
                    video.play().catch(() => undefined);
                }
                frame = requestAnimationFrame(tick);
            })
            .catch((error) => {
                if (!stopped) onErrorRef.current(errorKind(error));
            });

        return () => {
            stopped = true;
            cancelAnimationFrame(frame);
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    return (
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-900 sm:aspect-[4/3]">
            <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/5 w-3/5 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
            </div>
        </div>
    );
}
