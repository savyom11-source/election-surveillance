// ============================================================
// RECORDINGS PAGE — Search recordings by location + date range
// Plays back via signed S3 URLs
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Search, Film, Calendar, Play, Clock, HardDrive, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { recordingsApi, locationsApi, camerasApi } from '../api/services';

function formatDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export default function RecordingsPage() {
  const [recordings, setRecordings]   = useState([]);
  const [loading, setLoading]         = useState(false);
  const [states, setStates]           = useState([]);
  const [cameras, setCameras]         = useState([]);
  const [selectedState, setSelectedState]   = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [pagination, setPagination]   = useState(null);
  const [page, setPage]               = useState(1);
  const [playingId, setPlayingId]     = useState(null);
  const [playUrl, setPlayUrl]         = useState('');
  const [playLoading, setPlayLoading] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    locationsApi.getStates().then((r) => setStates(r.data.data)).catch(() => {});
    camerasApi.list({ limit: 200 }).then((r) => setCameras(r.data.data)).catch(() => {});
  }, []);

  async function search(p = 1) {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (selectedCamera) params.cameraId = selectedCamera;
      if (selectedState) params.stateId = selectedState;
      if (fromDate) params.from = new Date(fromDate).toISOString();
      if (toDate) params.to = new Date(toDate + 'T23:59:59').toISOString();

      const res = await recordingsApi.list(params);
      setRecordings(res.data.data);
      setPagination(res.data.pagination);
      setPage(p);
    } catch {
      toast.error('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }

  async function playRecording(id) {
    if (playingId === id) { setPlayingId(null); setPlayUrl(''); return; }
    setPlayLoading(true);
    try {
      const res = await recordingsApi.playUrl(id);
      if (!res.data.success) {
        toast.error(res.data.data?.message || 'Recording not available');
        return;
      }
      setPlayUrl(res.data.data.playUrl);
      setPlayingId(id);
      setTimeout(() => videoRef.current?.play(), 100);
    } catch {
      toast.error('Failed to get playback URL');
    } finally {
      setPlayLoading(false);
    }
  }

  const filteredCameras = selectedState
    ? cameras.filter((c) => c.office?.district?.state?.id === selectedState)
    : cameras;

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// AUDIT & VALIDATION</div>
        <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>Recording Viewer</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>Search and play back election recordings stored on AWS S3</p>
      </div>

      {/* Search filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <Search size={14} color="var(--accent)" />
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-bright)' }}>Search Recordings</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">State</label>
              <select className="form-input" value={selectedState} onChange={(e) => { setSelectedState(e.target.value); setSelectedCamera(''); }}>
                <option value="">All States</option>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Camera</label>
              <select className="form-input" value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
                <option value="">All Cameras</option>
                {filteredCameras.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.office?.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input type="date" className="form-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input type="date" className="form-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => search(1)} disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Searching...</> : <><Search size={14} /> Search</>}
            </button>
            <button className="btn btn-ghost" onClick={() => { setSelectedState(''); setSelectedCamera(''); setFromDate(''); setToDate(''); setRecordings([]); setPagination(null); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Video player */}
      {playingId && playUrl && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid var(--accent)' }}>
          <div className="card-header">
            <Play size={14} color="var(--accent)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase' }}>Now Playing</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setPlayingId(null); setPlayUrl(''); }}>✕ Close</button>
          </div>
          <div style={{ background: '#000', aspectRatio: '16/9', maxHeight: 480 }}>
            <video ref={videoRef} src={playUrl} controls style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}

      {/* Results */}
      {recordings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <Film size={14} color="var(--accent)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: 'var(--text-bright)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Results — {pagination?.total || 0} recordings
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recorded At</th>
                  <th>Camera</th>
                  <th>Office</th>
                  <th>State</th>
                  <th>Duration</th>
                  <th>Size</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((rec) => (
                  <tr key={rec.id} style={{ background: playingId === rec.id ? 'rgba(0,200,255,0.04)' : '' }}>
                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: 11 }}>
                      <div style={{ color: 'var(--text-bright)' }}>{format(new Date(rec.recordedAt), 'dd MMM yyyy')}</div>
                      <div style={{ color: 'var(--text-dim)' }}>{format(new Date(rec.recordedAt), 'HH:mm:ss')}</div>
                    </td>
                    <td style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{rec.camera?.name}</td>
                    <td>{rec.camera?.office?.name}</td>
                    <td><span className="badge badge-blue">{rec.camera?.office?.district?.state?.code}</span></td>
                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{formatDuration(rec.durationSec)}</div>
                    </td>
                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><HardDrive size={11} />{rec.fileSizeMb ? `${rec.fileSizeMb.toFixed(1)} MB` : '—'}</div>
                    </td>
                    <td>
                      <button className={`btn btn-sm ${playingId === rec.id ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => playRecording(rec.id)} disabled={playLoading}>
                        <Play size={12} />{playingId === rec.id ? 'Playing' : 'Play'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => search(page - 1)}>← Prev</button>
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)' }}>Page {page} of {pagination.totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page === pagination.totalPages} onClick={() => search(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Empty */}
      {!loading && recordings.length === 0 && pagination && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
          <Film size={40} opacity={0.3} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12 }}>No recordings found for this search</p>
        </div>
      )}

      {!pagination && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
          <Search size={40} opacity={0.3} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12 }}>Select filters above and press Search</p>
        </div>
      )}
    </div>
  );
}
