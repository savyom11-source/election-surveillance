// ============================================================
// DASHBOARD — Live camera grid, lazy-loads visible feeds only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Video, Filter, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Maximize } from 'lucide-react';
import toast from 'react-hot-toast';
import { camerasApi, locationsApi } from '../api/services';
import HLSPlayer from '../components/ui/HLSPlayer';
import useAuthStore from '../store/authStore';

const STATUS_BADGE = {
  ACTIVE: 'badge-green',
  INACTIVE: 'badge-dim',
  NOT_CONNECTED: 'badge-yellow',
};

export default function Dashboard({ isStandalone = false }) {
  const [cameras, setCameras]         = useState([]);
  const [states, setStates]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [gridLayout, setGridLayout]   = useState('2:4');
  const [autoRotate, setAutoRotate]   = useState(true);
  const [rotateInterval, setRotateInterval] = useState(30000);
  const [crowdThreshold, setCrowdThreshold] = useState(10);
  const [headcounts, setHeadcounts]   = useState({});
  const [selectedState, setSelectedState]       = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedOffice, setSelectedOffice]     = useState('');
  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [districts, setDistricts]               = useState([]);
  const [assemblies, setAssemblies]             = useState([]);
  const [offices, setOffices]                   = useState([]);
  const [statusFilter, setStatusFilter]         = useState('ALL');
  const [placementFilter, setPlacementFilter]   = useState('');
  const [streamIdFilter, setStreamIdFilter]     = useState('');
  const [showControls, setShowControls]         = useState(!isStandalone);
  const [expandedCamera, setExpandedCamera]     = useState(null);
  const [page, setPage]               = useState(1);
  const [pagination, setPagination]   = useState(null);
  
  const user = useAuthStore(state => state.user);
  
  // Helper booleans for role-based locking
  const isStateLocked = ['STATE_ADMIN', 'DISTRICT_OBSERVER', 'OFFICE_OBSERVER'].includes(user?.role);
  const isDistrictLocked = ['DISTRICT_OBSERVER', 'OFFICE_OBSERVER'].includes(user?.role);
  const isOfficeLocked = ['OFFICE_OBSERVER'].includes(user?.role);

  // Derived limit from grid layout
  const [rows, cols] = gridLayout.split(':').map(Number);
  const gridLimit = rows * cols;

  const fetchCameras = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = { page, limit: gridLimit };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (placementFilter) params.placement = placementFilter;
      if (streamIdFilter) params.streamId = streamIdFilter;
      if (selectedOffice) params.officeId = selectedOffice;
      else if (selectedAssembly) params.assemblyId = selectedAssembly;
      else if (selectedDistrict) params.districtId = selectedDistrict;
      else if (selectedState) params.stateId = selectedState;

      const res = await camerasApi.list(params);
      const fetchedPagination = res.data.pagination;
      
      // If we are on a page that no longer exists (e.g. cameras went offline), reset to page 1
      if (page > 1 && fetchedPagination.totalPages > 0 && page > fetchedPagination.totalPages) {
        setPage(1);
        return; // The useEffect on `page` will re-trigger fetchCameras naturally
      }

      setCameras(res.data.data);
      setPagination(fetchedPagination);
    } catch {
      toast.error('Failed to load cameras');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter, placementFilter, streamIdFilter, selectedState, selectedDistrict, selectedAssembly, selectedOffice, gridLimit]);

  // Auto-rotation timer
  useEffect(() => {
    if (!autoRotate || !pagination || pagination.totalPages <= 1) return;
    
    const timer = setInterval(() => {
      setPage(prev => (prev >= pagination.totalPages ? 1 : prev + 1));
    }, rotateInterval);
    
    return () => clearInterval(timer);
  }, [autoRotate, rotateInterval, pagination]);

  // Background polling for camera statuses (syncing across systems)
  useEffect(() => {
    // If auto-rotate is aggressively changing pages, we don't need this to clash
    if (autoRotate && pagination && pagination.totalPages > 1) return;
    
    const timer = setInterval(() => {
      if (!loading && !refreshing) {
        fetchCameras(true);
      }
    }, 15000); // 15 seconds
    
    return () => clearInterval(timer);
  }, [autoRotate, pagination, loading, refreshing, fetchCameras]);

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
      setOffices([]);
      setSelectedOffice('');
    }
  }, [selectedState, isDistrictLocked]);

  useEffect(() => {
    if (selectedDistrict) {
      locationsApi.getAssemblies({ districtId: selectedDistrict })
        .then((r) => {
          const fetchedAssemblies = r.data.data;
          setAssemblies(fetchedAssemblies);
        })
        .catch(() => {});
    } else {
      setAssemblies([]);
      setSelectedAssembly('');
      setOffices([]);
      setSelectedOffice('');
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedAssembly) {
      locationsApi.getOffices({ assemblyId: selectedAssembly })
        .then((r) => {
          const fetchedOffices = r.data.data;
          setOffices(fetchedOffices);
          if (fetchedOffices.length === 1 && isOfficeLocked) {
            setSelectedOffice(fetchedOffices[0].id);
          }
        })
        .catch(() => {});
    } else {
      setOffices([]);
      setSelectedOffice('');
    }
  }, [selectedAssembly, isOfficeLocked]);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        toast.error(`Could not enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const activeCameras   = cameras.filter((c) => c.status === 'ACTIVE').length;
  const inactiveCameras = cameras.filter((c) => c.status !== 'ACTIVE').length;

  return (
    <div className="fade-in" style={{ 
      padding: (isStandalone || !showControls) ? 0 : 12, 
      height: isStandalone ? '100vh' : '100%', 
      minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative',
      background: (isStandalone || !showControls) ? '#000' : 'transparent'
    }}>

      {!showControls && !isStandalone && document.getElementById('topbar-actions') && createPortal(
        <button className="btn btn-sm" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', marginRight: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', color: 'var(--text-bright)' }} onClick={() => setShowControls(true)}>
          <ChevronDown size={14} /> <span style={{ fontSize: 11, fontWeight: 600 }}>SHOW CONTROLS</span>
        </button>,
        document.getElementById('topbar-actions')
      )}
      {!showControls && isStandalone && (
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, display: 'flex', gap: 10 }}>
          <button className="btn btn-sm" title="Toggle Fullscreen" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }} onClick={toggleFullScreen}>
            <Maximize size={16} />
          </button>
          <button className="btn btn-sm" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }} onClick={() => setShowControls(true)}>
            <ChevronDown size={14} /> <span style={{ fontSize: 11, fontWeight: 600 }}>CONTROLS</span>
          </button>
        </div>
      )}

      {showControls && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h1 style={{ fontFamily: 'Barlow Condensed', fontSize: 24, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>
                Camera Dashboard
              </h1>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ padding: '0 10px', height: 26, display: 'flex', alignItems: 'center', border: '1px solid rgba(0,255,100,0.3)', background: 'rgba(0,255,100,0.1)', borderRadius: 5 }}>
                <span className="badge badge-green" style={{ fontSize: 10 }}>● Showing {cameras.length} of {pagination?.total || 0} Cameras</span>
              </div>

              {/* Auto Rotate Toggle & Interval */}
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                <button className="btn btn-sm" 
                  onClick={() => setAutoRotate(!autoRotate)}
                  style={{ 
                    border: 'none', borderRadius: 0, padding: '0 8px', height: 26, fontSize: 11,
                    background: autoRotate ? 'rgba(0,200,255,0.1)' : 'transparent',
                    color: autoRotate ? 'var(--accent)' : 'var(--text-dim)' 
                  }}>
                  {autoRotate ? '⏸ Auto' : '▶ Paused'}
                </button>
                <select 
                  className="form-input" 
                  style={{ width: 'auto', padding: '0 6px', fontSize: 11, height: 26, border: 'none', borderLeft: '1px solid var(--border)', borderRadius: 0, background: 'transparent' }}
                  value={rotateInterval} 
                  onChange={(e) => setRotateInterval(Number(e.target.value))}
                  disabled={!autoRotate}
                >
                  <option value={10000} style={{ background: 'var(--surface)', color: 'var(--text)' }}>10s</option>
                  <option value={20000} style={{ background: 'var(--surface)', color: 'var(--text)' }}>20s</option>
                  <option value={30000} style={{ background: 'var(--surface)', color: 'var(--text)' }}>30s</option>
                  <option value={40000} style={{ background: 'var(--surface)', color: 'var(--text)' }}>40s</option>
                  <option value={50000} style={{ background: 'var(--surface)', color: 'var(--text)' }}>50s</option>
                  <option value={60000} style={{ background: 'var(--surface)', color: 'var(--text)' }}>1m</option>
                </select>
              </div>

              {/* Grid Layout Selector */}
              <select className="form-input" style={{ width: 'auto', padding: '0 8px', fontSize: 11, height: 26 }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 26, background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', borderRadius: 5 }}>
                <span style={{ fontSize: 9, fontFamily: 'Share Tech Mono', color: 'var(--text-bright)' }}>🚨 ALERT IF ></span>
                <input type="number" className="form-input" style={{ width: 34, height: 18, padding: '0 2px', fontSize: 11, textAlign: 'center' }}
                  value={crowdThreshold} onChange={(e) => setCrowdThreshold(Number(e.target.value))} />
                <span style={{ fontSize: 9, fontFamily: 'Share Tech Mono', color: 'var(--text-bright)' }}>PPL</span>
              </div>

              <button className="btn btn-ghost btn-sm" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => fetchCameras(true)} disabled={refreshing}>
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> REFRESH
              </button>

              <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => setShowControls(false)} title="Hide Controls">
                <ChevronUp size={12} /> HIDE
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="card mb-3" style={{ padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', marginRight: 8 }}>
              <Filter size={16} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: 'Share Tech Mono' }}>FILTER:</span>
            </div>

            <input
              type="text"
              placeholder="Stream ID..."
              className="form-input"
              style={{ width: 140, padding: '6px 12px', fontSize: 12 }}
              value={streamIdFilter}
              onChange={(e) => { setStreamIdFilter(e.target.value); setPage(1); }}
            />

            <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
              value={selectedState} onChange={(e) => { setSelectedState(e.target.value); setSelectedDistrict(''); setSelectedAssembly(''); setSelectedOffice(''); setPage(1); }}
              disabled={isStateLocked}>
              <option value="">All States</option>
              {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {districts.length > 0 && (
              <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedAssembly(''); setSelectedOffice(''); setPage(1); }}
                disabled={isDistrictLocked}>
              <option value="">All Districts</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            )}

            {assemblies.length > 0 && (
              <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                value={selectedAssembly} onChange={(e) => { setSelectedAssembly(e.target.value); setSelectedOffice(''); setPage(1); }}>
              <option value="">All Assemblies</option>
              {assemblies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            )}

            {offices.length > 0 && (
              <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                value={selectedOffice} onChange={(e) => { setSelectedOffice(e.target.value); setPage(1); }}
                disabled={isOfficeLocked}>
              <option value="">All Polling Stations</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
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
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="NOT_CONNECTED">Not Connected</option>
            </select>

            {(selectedState || selectedDistrict || selectedAssembly || selectedOffice || statusFilter !== 'ALL' || placementFilter || streamIdFilter) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { 
                if (!isStateLocked) setSelectedState(''); 
                if (!isDistrictLocked) setSelectedDistrict(''); 
                setSelectedAssembly('');
                if (!isOfficeLocked) setSelectedOffice('');
                setStatusFilter('ALL'); 
                setPlacementFilter('');
                setStreamIdFilter('');
                setPage(1); 
              }}>
                Clear
              </button>
            )}
          </div>
        </>
      )}

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
      {!loading && cameras.length > 0 && (
        <div style={{ 
          flex: 1, 
          minHeight: 0,
          display: 'grid', 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 1,
          backgroundColor: '#555',
          border: '1px solid #555'
        }}>
          {cameras.map((cam) => {
            const currentCount = headcounts[cam.id] || 0;
            const isCrowded = currentCount >= crowdThreshold;

            return (
            <div key={cam.id} className="camera-cell" style={{ background: '#000', cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
              onClick={() => setExpandedCamera(expandedCamera === cam.id ? null : cam.id)}>
              <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {cam.status === 'ACTIVE' && cam.hlsUrl ? (
                  <HLSPlayer src={cam.hlsUrl} autoPlay={true} onHeadcountUpdate={(count) => setHeadcounts(prev => ({ ...prev, [cam.id]: count }))} crowdThreshold={crowdThreshold} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-dim)' }}>
                    <AlertCircle size={28} />
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 1 }}>{cam.status}</span>
                  </div>
                )}
                
                {isCrowded && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '4px solid red', pointerEvents: 'none', zIndex: 20 }} />
                )}
              </div>
              
              {/* Footer Banner exactly like reference image */}
              <div style={{ height: 26, background: '#d2dcf0', color: '#0056b3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', fontSize: 12, fontWeight: 'bold', fontFamily: 'sans-serif', borderTop: '1px solid #555', minWidth: 0 }}>
                <div style={{ minWidth: 50, display: 'flex', alignItems: 'center' }}>
                  {cam.status === 'ACTIVE' && (
                    <span title="Crowd Count" style={{ background: 'rgba(0,86,179,0.1)', color: '#0056b3', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>👤 {currentCount}</span>
                  )}
                </div>
                <div style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px', minWidth: 0 }}>
                  {cam.office?.name} - {cam.name}
                </div>
                <div style={{ minWidth: 50, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                   <span style={{ fontSize: 10, color: cam.status === 'ACTIVE' ? '#008000' : '#cc0000', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>● {cam.status === 'NOT_CONNECTED' ? 'OFFLINE' : cam.status}</span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Floating Pagination for all modes */}
      {pagination && pagination.totalPages > 1 && (
        <>
          <button 
            disabled={page === 1} 
            onClick={() => setPage((p) => p - 1)}
            style={{ 
              position: 'absolute', bottom: 20, left: 20, zIndex: 100, 
              width: 40, height: 40, borderRadius: '50%',
              background: page === 1 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)', 
              color: page === 1 ? 'rgba(255,255,255,0.3)' : 'white', 
              border: '1px solid rgba(255,255,255,0.2)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
            <ChevronLeft size={24} />
          </button>
          
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
            background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
            padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)' }}>
              PAGE {pagination.page} / {pagination.totalPages}
            </span>
          </div>

          <button 
            disabled={page === pagination.totalPages} 
            onClick={() => setPage((p) => p + 1)}
            style={{ 
              position: 'absolute', bottom: 20, right: 20, zIndex: 100, 
              width: 40, height: 40, borderRadius: '50%',
              background: page === pagination.totalPages ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)', 
              color: page === pagination.totalPages ? 'rgba(255,255,255,0.3)' : 'white', 
              border: '1px solid rgba(255,255,255,0.2)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
            <ChevronRight size={24} />
          </button>
        </>
      )}
    </div>
  );
}
