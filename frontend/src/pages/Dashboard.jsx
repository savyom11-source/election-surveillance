// ============================================================
// DASHBOARD — Live camera grid, lazy-loads visible feeds only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Video, Filter, Grid, List, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { camerasApi, locationsApi } from '../api/services';
import HLSPlayer from '../components/ui/HLSPlayer';

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
  const [selectedState, setSelectedState]       = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districts, setDistricts]               = useState([]);
  const [statusFilter, setStatusFilter]         = useState('ACTIVE');
  const [placementFilter, setPlacementFilter]   = useState('');
  const [expandedCamera, setExpandedCamera]     = useState(null);
  const [page, setPage]               = useState(1);
  const [pagination, setPagination]   = useState(null);

  const fetchCameras = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = { page, limit: 20, ...(statusFilter && { status: statusFilter }) };
      if (placementFilter) params.placement = placementFilter;
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
  }, [page, statusFilter, placementFilter, selectedState, selectedDistrict]);

  useEffect(() => {
    locationsApi.getStates().then((r) => {
      const fetchedStates = r.data.data;
      setStates(fetchedStates);
      if (fetchedStates.length === 1) {
        setSelectedState(fetchedStates[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedState) {
      locationsApi.getDistricts({ stateId: selectedState })
        .then((r) => {
          const fetchedDistricts = r.data.data;
          setDistricts(fetchedDistricts);
          if (fetchedDistricts.length === 1) {
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
    <div className="fade-in" style={{ padding: '24px', minHeight: '100%' }}>

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

        <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
          value={selectedState} onChange={(e) => { setSelectedState(e.target.value); setSelectedDistrict(''); setPage(1); }}
          disabled={states.length === 1}>
          <option value="">All States</option>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {districts.length > 0 && (
          <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setPage(1); }}
            disabled={districts.length === 1}>
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

        {(selectedState || selectedDistrict || statusFilter !== 'ACTIVE' || placementFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { 
            if (states.length > 1) setSelectedState(''); 
            if (districts.length > 1) setSelectedDistrict(''); 
            setStatusFilter('ACTIVE'); 
            setPlacementFilter('');
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {cameras.map((cam) => (
            <div key={cam.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', borderColor: expandedCamera === cam.id ? 'var(--accent)' : 'var(--border)' }}
              onClick={() => setExpandedCamera(expandedCamera === cam.id ? null : cam.id)}>
              <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
                {cam.status === 'ACTIVE' && cam.hlsUrl ? (
                  <HLSPlayer src={cam.hlsUrl} autoplay={expandedCamera === cam.id} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-dim)' }}>
                    <AlertCircle size={28} />
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 1 }}>{cam.status}</span>
                  </div>
                )}
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
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
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, color: 'var(--text-bright)', marginBottom: 2 }}>{cam.name}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 0.5 }}>
                  {cam.office?.name} · {cam.office?.district?.name} · {cam.office?.district?.state?.code}
                </div>
              </div>
            </div>
          ))}
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
