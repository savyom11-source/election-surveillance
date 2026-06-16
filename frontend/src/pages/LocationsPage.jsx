// ============================================================
// LOCATIONS PAGE — Hierarchical tree browser
// State → District → Office → Camera list
// ============================================================

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, MapPin, Building2, Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { locationsApi, camerasApi } from '../api/services';

function CameraRow({ camera }) {
  const statusColor = { ACTIVE: 'var(--accent2)', INACTIVE: 'var(--text-dim)', MAINTENANCE: 'var(--warn)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 5, background: 'var(--bg)', border: '1px solid var(--border)', marginTop: 6 }}>
      <span className="status-dot" style={{ background: statusColor[camera.status] || 'var(--text-dim)', boxShadow: camera.status === 'ACTIVE' ? `0 0 6px ${statusColor.ACTIVE}` : 'none' }} />
      <Camera size={13} color="var(--text-dim)" />
      <span style={{ flex: 1, fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 14, color: 'var(--text-bright)' }}>{camera.name}</span>
      <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)' }}>{camera.status}</span>
      {camera.hlsUrl
        ? <span className="badge badge-green" style={{ fontSize: 8 }}>HLS ✓</span>
        : <span className="badge badge-dim" style={{ fontSize: 8 }}>No Stream</span>}
    </div>
  );
}

function OfficeRow({ office }) {
  const [open, setOpen] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!open && cameras.length === 0) {
      setLoading(true);
      try {
        const res = await camerasApi.list({ officeId: office.id, limit: 100 });
        setCameras(res.data.data);
      } catch { toast.error('Failed to load cameras'); }
      finally { setLoading(false); }
    }
    setOpen((o) => !o);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)', transition: 'background 0.15s' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface3)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface2)'}>
        {open ? <ChevronDown size={13} color="var(--accent)" /> : <ChevronRight size={13} color="var(--text-dim)" />}
        <Building2 size={13} color="var(--accent3)" />
        <span style={{ flex: 1, fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: 'var(--text-bright)' }}>{office.name}</span>
        <span className="badge badge-orange" style={{ fontSize: 8 }}>{office._count?.cameras || 0} cams</span>
      </div>
      {open && (
        <div style={{ paddingLeft: 24, marginTop: 4 }}>
          {loading && <div style={{ display: 'flex', gap: 8, padding: 8, color: 'var(--text-dim)', fontSize: 12 }}><div className="spinner" style={{ width: 14, height: 14 }} /> Loading cameras...</div>}
          {!loading && cameras.length === 0 && <p style={{ padding: 8, color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 11 }}>No cameras in this office</p>}
          {cameras.map((cam) => <CameraRow key={cam.id} camera={cam} />)}
        </div>
      )}
    </div>
  );
}

function DistrictRow({ district }) {
  const [open, setOpen] = useState(false);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!open && offices.length === 0) {
      setLoading(true);
      try {
        const res = await locationsApi.getOffices({ districtId: district.id });
        setOffices(res.data.data);
      } catch { toast.error('Failed to load offices'); }
      finally { setLoading(false); }
    }
    setOpen((o) => !o);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', transition: 'border-color 0.15s' }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent2)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
        {open ? <ChevronDown size={14} color="var(--accent2)" /> : <ChevronRight size={14} color="var(--text-dim)" />}
        <MapPin size={14} color="var(--accent2)" />
        <span style={{ flex: 1, fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, color: 'var(--text-bright)' }}>{district.name}</span>
        <span className="badge badge-dim" style={{ fontSize: 8 }}>{district.code}</span>
        <span className="badge badge-green" style={{ fontSize: 8 }}>{district._count?.offices || 0} offices</span>
      </div>
      {open && (
        <div style={{ paddingLeft: 28, marginTop: 4 }}>
          {loading && <div style={{ display: 'flex', gap: 8, padding: 8, color: 'var(--text-dim)', fontSize: 12 }}><div className="spinner" style={{ width: 14, height: 14 }} /> Loading offices...</div>}
          {!loading && offices.length === 0 && <p style={{ padding: 8, color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 11 }}>No offices in this district</p>}
          {offices.map((o) => <OfficeRow key={o.id} office={o} />)}
        </div>
      )}
    </div>
  );
}

export default function LocationsPage() {
  const [states, setStates] = useState([]);
  const [openStates, setOpenStates] = useState({});
  const [districtsByState, setDistrictsByState] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    locationsApi.getStates()
      .then((r) => setStates(r.data.data))
      .catch(() => toast.error('Failed to load states'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleState(stateId) {
    if (!openStates[stateId] && !districtsByState[stateId]) {
      setLoadingStates((l) => ({ ...l, [stateId]: true }));
      try {
        const res = await locationsApi.getDistricts({ stateId });
        setDistrictsByState((d) => ({ ...d, [stateId]: res.data.data }));
      } catch { toast.error('Failed to load districts'); }
      finally { setLoadingStates((l) => ({ ...l, [stateId]: false })); }
    }
    setOpenStates((o) => ({ ...o, [stateId]: !o[stateId] }));
  }

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// LOCATION HIERARCHY</div>
        <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>Location Browser</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>State → District → Office → Camera — click to expand</p>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Loading locations...</span>
        </div>
      )}

      {!loading && states.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
          <MapPin size={40} opacity={0.3} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12 }}>No locations available for your access scope</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {states.map((state) => (
          <div key={state.id} className="card">
            <div onClick={() => toggleState(state.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = ''}>
              {openStates[state.id] ? <ChevronDown size={16} color="var(--accent)" /> : <ChevronRight size={16} color="var(--text-dim)" />}
              <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 18, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1 }}>{state.name}</span>
              <span className="badge badge-blue" style={{ marginLeft: 4 }}>{state.code}</span>
              <span className="badge badge-dim" style={{ marginLeft: 'auto' }}>{state._count?.districts || 0} districts</span>
            </div>
            {openStates[state.id] && (
              <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
                {loadingStates[state.id] && (
                  <div style={{ display: 'flex', gap: 8, padding: 12, color: 'var(--text-dim)', fontSize: 12 }}>
                    <div className="spinner" style={{ width: 14, height: 14 }} /> Loading districts...
                  </div>
                )}
                {(districtsByState[state.id] || []).map((d) => <DistrictRow key={d.id} district={d} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
