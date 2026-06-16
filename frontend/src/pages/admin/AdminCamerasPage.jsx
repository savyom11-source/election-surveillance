// ============================================================
// ADMIN CAMERAS PAGE — CRUD for cameras + stream URL management
// Super Admin only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Camera, Plus, Search, Edit2, Trash2, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { camerasApi, locationsApi } from '../../api/services';

const STATUS_OPTS = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
const STATUS_BADGE = { ACTIVE: 'badge-green', INACTIVE: 'badge-dim', MAINTENANCE: 'badge-yellow' };

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

function CameraForm({ initial = {}, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({ name: '', description: '', rtspUrl: '', hlsUrl: '', status: 'ACTIVE', officeId: '', ...initial });
  const [offices, setOffices] = useState([]);

  useEffect(() => {
    locationsApi.getOffices().then((r) => setOffices(r.data.data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group">
        <label className="form-label">Camera Name</label>
        <input className="form-input" placeholder="e.g. Main Hall - Cam 1" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Description (optional)</label>
        <input className="form-input" placeholder="Covers main voting area" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Office</label>
        <select className="form-input" value={form.officeId} onChange={(e) => set('officeId', e.target.value)}>
          <option value="">Select Office</option>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.name} — {o.district?.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">RTSP URL (internal, never sent to browser)</label>
        <input className="form-input" placeholder="rtsp://192.168.1.100:554/stream1" value={form.rtspUrl} onChange={(e) => set('rtspUrl', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">HLS URL (browser playback URL)</label>
        <input className="form-input" placeholder="http://media-server:8080/hls/cam-001/index.m3u8" value={form.hlsUrl} onChange={(e) => set('hlsUrl', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Status</label>
        <select className="form-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSubmit(form)} disabled={loading}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving...</> : 'Save Camera'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default function AdminCamerasPage() {
  const [cameras, setCameras]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState(null);
  const [modal, setModal]         = useState(null); // null | 'create' | camera-object
  const [saving, setSaving]       = useState(false);

  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...(statusFilter && { status: statusFilter }) };
      const res = await camerasApi.list(params);
      setCameras(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load cameras'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);

  const filtered = search
    ? cameras.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.office?.name?.toLowerCase().includes(search.toLowerCase()))
    : cameras;

  async function handleCreate(form) {
    setSaving(true);
    try {
      await camerasApi.create(form);
      toast.success('Camera created');
      setModal(null);
      fetchCameras();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to create camera'); }
    finally { setSaving(false); }
  }

  async function handleUpdate(id, form) {
    setSaving(true);
    try {
      await camerasApi.update(id, form);
      toast.success('Camera updated');
      setModal(null);
      fetchCameras();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to update camera'); }
    finally { setSaving(false); }
  }

  async function handleDelete(cam) {
    if (!window.confirm(`Deactivate camera "${cam.name}"?`)) return;
    try {
      await camerasApi.delete(cam.id);
      toast.success('Camera deactivated');
      fetchCameras();
    } catch { toast.error('Failed to deactivate camera'); }
  }

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// ADMIN PANEL</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>Camera Management</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={14} /> Add Camera</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search camera or office..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={fetchCameras}><RefreshCw size={13} /></button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 12 }}>
            <div className="spinner" />
            <span style={{ color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Loading cameras...</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Camera</th><th>Office</th><th>District</th><th>State</th><th>Status</th><th>HLS</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((cam) => (
                  <tr key={cam.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={13} color="var(--text-dim)" />{cam.name}
                      </div>
                      {cam.description && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{cam.description}</div>}
                    </td>
                    <td>{cam.office?.name}</td>
                    <td>{cam.office?.district?.name}</td>
                    <td><span className="badge badge-blue">{cam.office?.district?.state?.code}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[cam.status] || 'badge-dim'}`}>● {cam.status}</span></td>
                    <td>
                      {cam.hlsUrl
                        ? <span className="badge badge-green">✓ Set</span>
                        : <span className="badge badge-red">✗ Missing</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(cam)}><Edit2 size={12} />Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cam)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)' }}>Page {page} of {pagination.totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {modal === 'create' && (
        <Modal title="Add Camera" onClose={() => setModal(null)}>
          <CameraForm onSubmit={handleCreate} onClose={() => setModal(null)} loading={saving} />
        </Modal>
      )}

      {modal && modal !== 'create' && (
        <Modal title="Edit Camera" onClose={() => setModal(null)}>
          <CameraForm initial={modal} onSubmit={(form) => handleUpdate(modal.id, form)} onClose={() => setModal(null)} loading={saving} />
        </Modal>
      )}
    </div>
  );
}
