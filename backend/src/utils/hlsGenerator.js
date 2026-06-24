// ============================================================
// HLS URL GENERATOR
// Converts a stream URL (RTMP or RTSP) to an HLS playback URL
// using the configured MediaMTX server.
//
// MediaMTX receives RTMP/RTSP and serves HLS at:
//   {MEDIAMTX_SERVER}/{path}/index.m3u8
//
// Examples:
//   rtmp://swastik.kcslivestream.com:1935/live/RDNL3117
//     → http://localhost:8888/live/RDNL3117/index.m3u8
//
//   rtmp://vendor.com:1935/stream/CAM005
//     → http://localhost:8888/stream/CAM005/index.m3u8
//
//   rtsp://192.168.1.101:554/stream1
//     → http://localhost:8888/stream1/index.m3u8
//
// ============================================================

const env = require('../config/env');

/**
 * generateHlsUrl
 * Extracts the path from a stream URL and builds the HLS URL
 * using the MediaMTX server base address.
 *
 * @param {string} streamUrl - RTMP or RTSP URL
 * @returns {string} HLS playback URL
 */
function generateHlsUrl(streamUrl) {
  if (!streamUrl) return null;

  try {
    const url = new URL(streamUrl);

    // pathname gives us e.g. /live/RDNL3117 or /stream/CAM005
    // Remove leading slash for clean path
    let path = url.pathname.replace(/^\//, '');

    // Remove trailing slash if any
    path = path.replace(/\/$/, '');

    // Remove empty segments
    if (!path) return null;

    const mediaMtxServer = env.mediaMtx.server.replace(/\/$/, '');

    return `${mediaMtxServer}/${path}/index.m3u8`;
  } catch {
    return null;
  }
}

/**
 * validateStreamUrl
 * Checks if a stream URL is valid RTMP or RTSP
 *
 * @param {string} streamUrl
 * @returns {{ valid: boolean, type: 'RTMP'|'RTSP'|null, error: string|null }}
 */
function validateStreamUrl(streamUrl) {
  if (!streamUrl) {
    return { valid: false, type: null, error: 'Stream URL is required' };
  }

  try {
    const url = new URL(streamUrl);

    if (url.protocol === 'rtmp:') {
      // Must have a path with at least one segment (app name + stream key)
      const parts = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
      if (parts.length < 2) {
        return {
          valid: false,
          type: 'RTMP',
          error: 'RTMP URL must include app name and stream key e.g. rtmp://server:1935/live/KEY123',
        };
      }
      return { valid: true, type: 'RTMP', error: null };
    }

    if (url.protocol === 'rtsp:') {
      const parts = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
      if (parts.length < 1) {
        return {
          valid: false,
          type: 'RTSP',
          error: 'RTSP URL must include a stream path e.g. rtsp://192.168.1.1:554/stream1',
        };
      }
      return { valid: true, type: 'RTSP', error: null };
    }

    return {
      valid: false,
      type: null,
      error: 'Stream URL must start with rtmp:// or rtsp://',
    };
  } catch {
    return {
      valid: false,
      type: null,
      error: 'Invalid URL format',
    };
  }
}

/**
 * detectStreamType
 * Auto-detects stream type from URL protocol
 *
 * @param {string} streamUrl
 * @returns {'RTMP'|'RTSP'}
 */
function detectStreamType(streamUrl) {
  if (!streamUrl) return 'RTMP';
  return streamUrl.toLowerCase().startsWith('rtsp://') ? 'RTSP' : 'RTMP';
}

module.exports = { generateHlsUrl, validateStreamUrl, detectStreamType };
