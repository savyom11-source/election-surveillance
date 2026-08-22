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

  const toggleFullscreen = (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      const target = containerRef.current?.closest('.camera-cell') || containerRef.current;
      target?.requestFullscreen().catch(() => {});
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
        backBufferLength: 5,
        liveSyncDurationCount: 3,      // Wait for 3 chunks before playing (healthy buffer)
        liveMaxLatencyDurationCount: 6, // Allow up to 6 chunks of latency before hls.js corrects it
        liveBackBufferLength: 0,
        maxLiveSyncPlaybackRate: 1.1,  // Speed up very gently (10%) to catch up without stuttering
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

      // Handle tab visibility changes to resume video and catch up to live edge
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && autoPlay) {
          if (video.paused) {
            video.play().catch(() => {});
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      // Gentle Drift Correction (runs every 5 seconds)
      const driftInterval = setInterval(() => {
        if (!video.paused && video.buffered && video.buffered.length > 0) {
          const bufferEnd = video.buffered.end(video.buffered.length - 1);
          const lag = bufferEnd - video.currentTime;
          
          // If we drift more than 20 seconds behind, we jump forward.
          // BUT we jump to 8 seconds behind the edge, giving it a healthy buffer so it never stutters!
          if (lag > 20) {
            video.currentTime = bufferEnd - 8;
          }
        }
      }, 5000);

      return () => { 
        document.removeEventListener('visibilitychange', handleVisibility);
        clearInterval(driftInterval);
        hls.destroy(); 
        hlsRef.current = null; 
      };

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        if (autoPlay) video.play().catch(() => {});
        setState('playing');
      });
      video.addEventListener('error', () => setState('error'));

      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && autoPlay) {
          if (video.paused) video.play().catch(() => {});
          // HTML5 native HLS live edge jump
          if (video.seekable.length > 0) {
            video.currentTime = video.seekable.end(video.seekable.length - 1);
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
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
    }, 1500 + Math.random() * 1000); 

    return () => clearInterval(interval);
  }, [state, autoPlay, onHeadcountUpdate]);

  const [isMuted, setIsMuted] = useState(true);
  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center group">
      <style>{`
        .custom-video::-webkit-media-controls-fullscreen-button {
          display: none;
        }
      `}</style>
      <video
        ref={videoRef}
        className="w-full h-full object-fill custom-video"
        muted={isMuted}
        playsInline
        controls
        onVolumeChange={() => {
          if (videoRef.current) setIsMuted(videoRef.current.muted || videoRef.current.volume === 0);
        }}
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
