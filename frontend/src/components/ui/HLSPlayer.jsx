// ============================================================
// HLS VIDEO PLAYER — Plays HLS streams via hls.js
// ============================================================

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { VideoOff, Loader2, AlertTriangle } from 'lucide-react';

export default function HLSPlayer({ src, cameraName, autoPlay = true }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [state, setState] = useState('loading'); // loading | playing | error | offline

  useEffect(() => {
    if (!src) { setState('offline'); return; }

    const video = videoRef.current;
    if (!video) return;

    setState('loading');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {});
        setState('playing');
      });

      let retryCount = 0;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            if (retryCount < 3) {
              retryCount++;
              setTimeout(() => {
                if (hlsRef.current) {
                  hls.loadSource(src);
                  hls.startLoad();
                }
              }, 2000);
            } else {
              hls.destroy();
              setState('error');
            }
          }
        }
      });

      return () => { hls.destroy(); hlsRef.current = null; };

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        if (autoPlay) video.play().catch(() => {});
        setState('playing');
      });
      video.addEventListener('error', () => setState('error'));

      return () => {
        video.removeAttribute('src');
        video.load();
      };
    } else {
      setState('error');
    }
  }, [src, autoPlay]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover rounded-lg"
        muted
        playsInline
        controls={state === 'playing'}
      />

      {/* Overlays */}
      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/90">
          <Loader2 className="w-6 h-6 text-primary-400 animate-spin mb-2" />
          <p className="text-xs font-mono text-slate-500">Connecting...</p>
        </div>
      )}

      {state === 'offline' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/90">
          <VideoOff className="w-6 h-6 text-slate-600 mb-2" />
          <p className="text-xs font-mono text-slate-600">No stream configured</p>
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/90">
          <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
          <p className="text-xs font-mono text-red-500">Stream unavailable</p>
        </div>
      )}

      {/* LIVE badge */}
      {state === 'playing' && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5
                        bg-black/60 rounded px-2 py-0.5">
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="font-mono text-[10px] text-white tracking-widest">LIVE</span>
        </div>
      )}
    </div>
  );
}
