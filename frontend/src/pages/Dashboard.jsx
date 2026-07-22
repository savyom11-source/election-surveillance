// ============================================================
// DASHBOARD — Live camera grid, lazy-loads visible feeds only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Video, Filter, Grid, List, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { camerasApi, locationsApi } from '../api/services';
import HLSPlayer from '../components/ui/HLSPlayer';
import useAuthStore from '../store/authStore';

const STATUS_BADGE = {
  ACTIVE:      'badge-green',
  INACTIVE:    'badge-dim',
  MAINTENANCE: 'badge-yellow',
};

export default function Dashboard() {
  const [cameras, setCameras]         = useState([]);
  const [states, setStates]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [view, setView]               = useState('grid'); // 'grid' | 'list'
  const [gridLayout, setGridLayout]   = useState('2:4');
  const [autoRotate, setAutoRotate]   = useState(true);
  const [rotateInterval, setRotateInterval] = useState(30000);
  const [crowdThreshold, setCrowdThreshold] = useState(10);
  const [headcounts, setHeadcounts]   = useState({});
  const [selectedState, setSelectedState]       = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districts, setDistricts]               = useState([]);
  const [statusFilter, setStatusFilter]         = useState('ACTIVE');
  const [placementFilter, setPlacementFilter]   = useState('');
  const [streamIdFilter, setStreamIdFilter]     = useState('');
  const [expandedCamera, setExpandedCamera]     = useState(null);
  const [page, setPage]               = useState(1);
  const [pagination, setPagination]   = useState(null);
  
  const user = useAuthStore(state => state.user);
  
  // Helper booleans for role-based locking
  const isStateLocked = ['STATE_ADMIN', 'DISTRICT_OBSERVER', 'OFFICE_OBSERVER'].includes(user?.role);
  const isDistrictLocked = ['DISTRICT_OBSERVER', 'OFFICE_OBSERVER'].includes(user?.role);

  // Derived limit from grid layout
  const [rows, cols] = gridLayout.split(':').map(Number);
  const gridLimit = view === 'grid' ? (rows * cols) : 20;

  const fetchCameras = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = { page, limit: gridLimit, ...(statusFilter && { status: statusFilter }) };
      if (placementFilter) params.placement = placementFilter;
      if (streamIdFilter) params.streamId = streamIdFilter;
      if (selectedDistrict) params.districtId = selectedDistrict;
      else if (selectedState) params.stateId = selectedState;

      const res = await camerasApi.list(params);
      setCameras(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load cameras');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter, placementFilter, streamIdFilter, selectedState, selectedDistrict, gridLimit]);

  // Auto-rotation timer
  useEffect(() => {
    if (!autoRotate || !pagination || pagination.totalPages <= 1 || view !== 'grid') return;
    
    const timer = setInterval(() => {
      setPage(prev => (prev >= pagination.totalPages ? 1 : prev + 1));
    }, rotateInterval);
    
    return () => clearInterval(timer);
  }, [autoRotate, rotateInterval, pagination, view]);

  useEffect(() => {
    locationsApi.getStates().then((r) => {
      const fetchedStates = r.data.data;
      setStates(fetchedStates);
      if (fetchedStates.length === 1 && isStateLocked) {
        setSelectedState(fetchedStates[0].id);
      }
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (selectedState) {
      locationsApi.getDistricts({ stateId: selectedState })
        .then((r) => {
          const fetchedDistricts = r.data.data;
          setDistricts(fetchedDistricts);
          if (fetchedDistricts.length === 1 && isDistrictLocked) {
            setSelectedDistrict(fetchedDistricts[0].id);
          }
        })
        .catch(() => {});
    } else {
      setDistricts([]);
      setSelectedDistrict('');
    }
  }, [selectedState]);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);

  const activeCameras   = cameras.filter((c) => c.status === 'ACTIVE').length;
  const inactiveCameras = cameras.filter((c) => c.status !== 'ACTIVE').length;

  return (
    <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// LIVE SURVEILLANCE</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Camera Dashboard
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-green">● {activeCameras} Live</span>
            {inactiveCameras > 0 && <span className="badge badge-dim">● {inactiveCameras} Offline</span>}
          </div>

          {view === 'grid' && (
            <>
              {/* Auto Rotate Toggle & Interval */}
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                <button className="btn btn-sm" 
                  onClick={() => setAutoRotate(!autoRotate)}
                  style={{ 
                    border: 'none', borderRadius: 0, padding: '0 10px', height: 30,
                    background: autoRotate ? 'rgba(0,200,255,0.1)' : 'transparent',
                    color: autoRotate ? 'var(--accent)' : 'var(--text-dim)' 
                  }}>
                  {autoRotate ? '⏸ Auto' : '▶ Paused'}
                </button>
                <select 
                  className="form-input" 
                  style={{ width: 'auto', padding: '0 8px', fontSize: 12, height: 30, border: 'none', borderLeft: '1px solid var(--border)', borderRadius: 0, background: 'transparent' }}
                  value={rotateInterval} 
                  onChange={(e) => setRotateInterval(Number(e.target.value))}
                  disabled={!autoRotate}
                >
                  <option value={10000}>10s</option>
                  <option value={20000}>20s</option>
                  <option value={30000}>30s</option>
                  <option value={40000}>40s</option>
                  <option value={50000}>50s</option>
                  <option value={60000}>1m</option>
                </select>
              </div>

              {/* Grid Layout Selector */}
              <select className="form-input" style={{ width: 'auto', padding: '0 10px', fontSize: 12, height: 30 }}
                value={gridLayout} onChange={(e) => { setGridLayout(e.target.value); setPage(1); }}>
                <option value="1:1">1x1 Matrix</option>
                <option value="1:2">1x2 Matrix</option>
                <option value="2:2">2x2 Matrix</option>
                <option value="2:3">2x3 Matrix</option>
                <option value="2:4">2x4 Matrix</option>
                <option value="3:3">3x3 Matrix</option>
                <option value="3:4">3x4 Matrix</option>
                <option value="4:4">4x4 Matrix</option>
              </select>

              {/* AI Crowd Threshold */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 30, background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', borderRadius: 5 }}>
                <span style={{ fontSize: 10, fontFamily: 'Share Tech Mono', color: 'var(--text-bright)' }}>🚨 ALERT IF ></span>
                <input type="number" className="form-input" style={{ width: 40, height: 20, padding: '0 4px', fontSize: 12, textAlign: 'center' }}
                  value={crowdThreshold} onChange={(e) => setCrowdThreshold(Number(e.target.value))} />
                <span style={{ fontSize: 10, fontFamily: 'Share Tech Mono', color: 'var(--text-bright)' }}>PPL</span>
              </div>
            </>
          )}

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {[['grid', <Grid size={14} />], ['list', <List size={14} />]].map(([v, icon]) => (
              <button key={v} onClick={() => setView(v)} className="btn btn-sm"
                style={{ borderRadius: 0, border: 'none', background: view === v ? 'var(--surface3)' : 'transparent', color: view === v ? 'var(--accent)' : 'var(--text-dim)' }}>
                {icon}
              </button>
            ))}
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => fetchCameras(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', alignItems: 'center' }}>
        <Filter size={14} color="var(--text-dim)" />
        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1 }}>FILTER:</span>

        <input 
          type="text" 
          placeholder="Stream ID..." 
          className="form-input" 
          style={{ width: 140, padding: '6px 12px', fontSize: 12 }} 
          value={streamIdFilter} 
          onChange={(e) => { setStreamIdFilter(e.target.value); setPage(1); }} 
        />

        <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
          value={selectedState} onChange={(e) => { setSelectedState(e.target.value); setSelectedDistrict(''); setPage(1); }}
          disabled={isStateLocked}>
          <option value="">All States</option>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {districts.length > 0 && (
          <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setPage(1); }}
            disabled={isDistrictLocked}>
            <option value="">All Districts</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
          value={placementFilter} onChange={(e) => { setPlacementFilter(e.target.value); setPage(1); }}>
          <option value="">All Placements</option>
          <option value="INSIDE">Inside (IN)</option>
          <option value="OUTSIDE">Outside (OUT)</option>
        </select>

        <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
          value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>

        {(selectedState || selectedDistrict || statusFilter !== 'ACTIVE' || placementFilter || streamIdFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { 
            if (!isStateLocked) setSelectedState(''); 
            if (!isDistrictLocked) setSelectedDistrict(''); 
            setStatusFilter('ACTIVE'); 
            setPlacementFilter('');
            setStreamIdFilter('');
            setPage(1); 
          }}>
            Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Loading feeds...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && cameras.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--text-dim)' }}>
          <Video size={40} opacity={0.3} />
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 1 }}>No cameras found for this filter</p>
        </div>
      )}

      {/* Grid View */}
      {!loading && cameras.length > 0 && view === 'grid' && (
        <div style={{ 
          flex: 1, 
          minHeight: 0,
          display: 'grid', 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 16,
          paddingBottom: 20
        }}>
          {cameras.map((cam) => {
            const currentCount = headcounts[cam.id] || 0;
            const isCrowded = currentCount >= crowdThreshold;

            const CCTVOverlay = (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-10 pb-2 px-3 flex flex-col justify-end pointer-events-none z-10">
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13, color: 'var(--text-bright)', textShadow: '1px 1px 2px #000', marginBottom: 1, letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cam.name}
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#ccc', textShadow: '1px 1px 2px #000', letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cam.office?.name} · {cam.office?.district?.name} · {cam.office?.district?.state?.code}
                </div>
              </div>
            );

            return (
            <div key={cam.id} className="card p-0 overflow-hidden" style={{ cursor: 'pointer', transition: 'all 0.2s', borderColor: isCrowded ? 'red' : (expandedCamera === cam.id ? 'var(--accent)' : 'var(--border)'), boxShadow: isCrowded ? '0 0 15px rgba(255,0,0,0.6)' : 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}
              onClick={() => setExpandedCamera(expandedCamera === cam.id ? null : cam.id)}>
              <div style={{ position: 'relative', background: '#000', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cam.status === 'ACTIVE' && cam.hlsUrl ? (
                  <HLSPlayer src={cam.hlsUrl} autoPlay={expandedCamera === cam.id} onHeadcountUpdate={(count) => setHeadcounts(prev => ({ ...prev, [cam.id]: count }))} crowdThreshold={crowdThreshold}>
                    {CCTVOverlay}
                  </HLSPlayer>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-dim)' }}>
                      <AlertCircle size={28} />
                      <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 1 }}>{cam.status}</span>
                    </div>
                    {CCTVOverlay}
                  </>
                )}
                
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'none' }}>
                  {cam.placement && (
                    <span className="badge badge-blue">
                      {cam.placement === 'INSIDE' ? 'IN' : 'OUT'}
                    </span>
                  )}
                  <span className={`badge ${STATUS_BADGE[cam.status] || 'badge-dim'}`}>
                    ● {cam.status}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!loading && cameras.length > 0 && view === 'list' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Camera</th>
                  <th>Office</th>
                  <th>District</th>
                  <th>State</th>
                  <th>Stream</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((cam) => (
                  <tr key={cam.id}>
                    <td><span className={`status-dot ${cam.status.toLowerCase()}`} /></td>
                    <td style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{cam.name}</td>
                    <td>{cam.office?.name}</td>
                    <td>{cam.office?.district?.name}</td>
                    <td><span className="badge badge-blue">{cam.office?.district?.state?.code}</span></td>
                    <td>
                      {cam.hlsUrl
                        ? <span className="badge badge-green">HLS ✓</span>
                        : <span className="badge badge-dim">No Stream</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} cameras)
          </span>
          <button className="btn btn-ghost btn-sm" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
