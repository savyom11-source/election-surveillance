// ============================================================
// ADMIN CAMERAS PAGE — RTMP/RTSP stream URL management
// hlsUrl auto-generated from streamUrl + MediaMTX server
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Camera, Plus, Search, Edit2, Trash2, RefreshCw, X, CheckCircle, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { camerasApi, locationsApi } from '../../api/services';

const STATUS_OPTS    = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
const STREAM_TYPES   = ['RTMP', 'RTSP'];
const STATUS_BADGE   = { ACTIVE: 'badge-green', INACTIVE: 'badge-dim', MAINTENANCE: 'badge-yellow' };
const TYPE_BADGE     = { RTMP: 'badge-orange', RTSP: 'badge-blue' };

const STREAM_PLACEHOLDERS = {
  RTMP: 'rtmp://vendor.com:1935/live/STREAM_KEY',
  RTSP: 'rtsp://192.168.1.100:554/stream1',
};

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
  const [form, setForm] = useState({ name: '', description: '', streamUrl: '', streamType: 'RTMP', status: 'ACTIVE', officeId: '', ...initial });
  const [offices, setOffices] = useState([]);

  useEffect(() => {
    locationsApi.getOffices().then((r) => setOffices(r.data.data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Preview what HLS URL will look like
  const hlsPreview = (() => {
    try {
      const parsed = new URL(form.streamUrl);
      return `[MediaMTX Server]${parsed.pathname}/index.m3u8`;
    } catch { return null; }
  })();

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

      {/* Stream Type selector */}
      <div className="form-group">
        <label className="form-label">Stream Type</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {STREAM_TYPES.map((t) => (
            <button key={t} type="button"
              onClick={() => set('streamType', t)}
              className={`btn btn-sm ${form.streamType === t ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Stream URL */}
      <div className="form-group">
        <label className="form-label">
          {form.streamType} Stream URL
          <span style={{ marginLeft: 8, color: 'var(--text-dim)', fontSize: 10 }}>(from camera vendor)</span>
        </label>
        <input
          className="form-input"
          placeholder={STREAM_PLACEHOLDERS[form.streamType]}
          value={form.streamUrl}
          onChange={(e) => set('streamUrl', e.target.value)}
          style={{ fontFamily: 'Share Tech Mono', fontSize: 12 }}
        />
        {/* HLS preview */}
        {hlsPreview && (
          <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: 4 }}>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--accent2)', letterSpacing: 1, marginBottom: 3 }}>AUTO-GENERATED HLS URL:</div>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)' }}>{hlsPreview}</div>
          </div>
        )}
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

function BulkUploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return toast.error('Please select an Excel file first');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await camerasApi.bulkUpload(formData);
      toast.success(res.data.data.message || 'Upload successful');
      if (res.data.data.errors && res.data.data.errors.length > 0) {
        console.warn('Upload had some row errors:', res.data.data.errors);
        toast.error(`Completed with ${res.data.data.errors.length} errors. Check console.`);
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Upload an Excel file to bulk import cameras. The file must include columns for <b>State</b>, <b>District</b>, <b>Assembly/Office</b>, and <b>ID</b> (e.g., live/STREAM). Optional columns: <b>IN/OUT</b>, <b>RTMP/RTSP</b>, <b>Camera Name</b>.
      </div>
      <div className="form-group">
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          onChange={(e) => setFile(e.target.files[0])} 
          className="form-input" 
          style={{ padding: '12px 16px' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpload} disabled={uploading || !file}>
          {uploading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Uploading...</> : 'Upload & Process'}
        </button>
        <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>Cancel</button>
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
  const [modal, setModal]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [actioning, setActioning] = useState(null);

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
      setModal(null); fetchCameras();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to create camera'); }
    finally { setSaving(false); }
  }

  async function handleUpdate(id, form) {
    setSaving(true);
    try {
      await camerasApi.update(id, form);
      toast.success('Camera updated');
      setModal(null); fetchCameras();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to update camera'); }
    finally { setSaving(false); }
  }

  async function toggleActive(cam) {
    setActioning(cam.id);
    try {
      if (cam.isActive) {
        await camerasApi.delete(cam.id);
        toast.success(`"${cam.name}" deactivated`);
      } else {
        await camerasApi.update(cam.id, { isActive: true, status: 'ACTIVE' });
        toast.success(`"${cam.name}" reactivated`);
      }
      fetchCameras();
    } catch { toast.error('Action failed'); }
    finally { setActioning(null); }
  }

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// ADMIN PANEL</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>Camera Management</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>HLS URLs are auto-generated from RTMP/RTSP stream URLs via MediaMTX</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setModal('upload')}><Upload size={14} /> Bulk Upload</button>
          <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={14} /> Add Camera</button>
        </div>
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
            <div className="spinner" /><span style={{ color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Loading cameras...</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Camera</th><th>Office</th><th>State</th><th>Type</th><th>HLS Status</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((cam) => (
                  <tr key={cam.id} style={{ opacity: cam.isActive ? 1 : 0.5 }}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={13} color="var(--text-dim)" />{cam.name}
                      </div>
                      {cam.description && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{cam.description}</div>}
                    </td>
                    <td>{cam.office?.name}</td>
                    <td><span className="badge badge-blue">{cam.office?.district?.state?.code}</span></td>
                    <td><span className={`badge ${TYPE_BADGE[cam.streamType] || 'badge-dim'}`}>{cam.streamType}</span></td>
                    <td>
                      {cam.hlsUrl
                        ? <span className="badge badge-green">✓ Ready</span>
                        : <span className="badge badge-red">✗ No URL</span>}
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[cam.status] || 'badge-dim'}`}>● {cam.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(cam)}><Edit2 size={12} />Edit</button>
                        <button
                          className={`btn btn-sm ${cam.isActive ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => toggleActive(cam)}
                          disabled={actioning === cam.id}>
                          {actioning === cam.id
                            ? <div className="spinner" style={{ width: 12, height: 12 }} />
                            : cam.isActive ? <><Trash2 size={12} /></> : <><CheckCircle size={12} /></>}
                        </button>
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
      {modal === 'upload' && (
        <Modal title="Bulk Upload Cameras" onClose={() => setModal(null)}>
          <BulkUploadModal 
            onClose={() => setModal(null)} 
            onSuccess={() => { setModal(null); fetchCameras(); }} 
          />
        </Modal>
      )}
      {modal && modal !== 'create' && modal !== 'upload' && (
        <Modal title="Edit Camera" onClose={() => setModal(null)}>
          <CameraForm initial={modal} onSubmit={(form) => handleUpdate(modal.id, form)} onClose={() => setModal(null)} loading={saving} />
        </Modal>
      )}
    </div>
  );
}
