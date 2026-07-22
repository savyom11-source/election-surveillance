// ============================================================
// HLS VIDEO PLAYER — Plays HLS streams via hls.js
// ============================================================

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { VideoOff, Loader2, AlertTriangle, Maximize } from 'lucide-react';
import '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let tfModel = null;
let modelLoading = false;

export default function HLSPlayer({ src, cameraName, autoPlay = true, onHeadcountUpdate, crowdThreshold = 10, children }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [state, setState] = useState('loading'); // loading | playing | error | offline
  const [headcount, setHeadcount] = useState(0);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    if (!src) { setState('offline'); return; }

    const video = videoRef.current;
    if (!video) return;

    setState('loading');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10, // Keep less old video in memory
        liveSyncDurationCount: 3, // Target 3 segments from the live edge
        liveMaxLatencyDurationCount: 5, // If we fall behind by 5 segments (e.g. background tab), jump instantly to the live edge
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

  // AI Crowd Detection
  useEffect(() => {
    if (!autoPlay || state !== 'playing') return;

    if (!tfModel && !modelLoading) {
      modelLoading = true;
      cocoSsd.load().then(m => {
        tfModel = m;
        modelLoading = false;
      }).catch(err => {
        console.error('Failed to load COCO-SSD:', err);
        modelLoading = false;
      });
    }

    const interval = setInterval(async () => {
      if (!tfModel || !videoRef.current) return;
      try {
        const predictions = await tfModel.detect(videoRef.current);
        const personCount = predictions.filter(p => p.class === 'person').length;
        setHeadcount(personCount);
        if (onHeadcountUpdate) onHeadcountUpdate(personCount);
      } catch (e) {
        // Ignore detection errors
      }
    }, 1500 + Math.random() * 1000); // Stagger intervals between 1.5 - 2.5 seconds (averages 2s)

    return () => clearInterval(interval);
  }, [state, autoPlay, onHeadcountUpdate]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center group" style={{ borderRadius: '6px 6px 0 0' }}>
      <style>{`
        .custom-video::-webkit-media-controls-fullscreen-button {
          display: none;
        }
      `}</style>
      <video
        ref={videoRef}
        className="w-full h-full object-contain custom-video"
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

      {/* LIVE badge and Fullscreen Overlays */}
      {state === 'playing' && (
        <>
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-0.5">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <span className="font-mono text-[10px] text-white tracking-widest">LIVE</span>
          </div>
          
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <span style={{ background: '#ffcc00', color: '#000', padding: '2px 8px', borderRadius: 4, fontWeight: 900, fontSize: 11, fontFamily: 'Share Tech Mono', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              👤 {headcount}
            </span>
            <button onClick={toggleFullscreen} className="bg-black/60 p-1.5 rounded text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100" title="Full Screen">
              <Maximize size={14} />
            </button>
          </div>

          {/* Overcrowded Badge */}
          {headcount >= crowdThreshold && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'red', color: 'white', padding: '4px 12px', borderRadius: 20, fontWeight: 'bold', fontSize: 12, zIndex: 10, whiteSpace: 'nowrap', border: '2px solid white' }}>
              🚨 OVERCROWDED: {headcount} DETECTED
            </div>
          )}
        </>
      )}

      {/* Custom Overlays Injected by Parent */}
      {children}
    </div>
  );
}
