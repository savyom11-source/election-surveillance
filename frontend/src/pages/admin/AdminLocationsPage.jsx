// ============================================================
// ADMIN LOCATIONS PAGE — Manage States, Districts, Offices
// Super Admin only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2, ChevronRight, ChevronDown, X, Building2, Map } from 'lucide-react';
import toast from 'react-hot-toast';
import { locationsApi } from '../../api/services';

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

// ---- State Form ----
function StateForm({ initial = {}, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({ name: '', code: '', ...initial });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group">
        <label className="form-label">State Name</label>
        <input className="form-input" placeholder="e.g. Rajasthan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">State Code</label>
        <input className="form-input" placeholder="e.g. RJ" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSubmit(form)} disabled={loading}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving...</> : 'Save State'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ---- District Form ----
function DistrictForm({ initial = {}, states, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({ name: '', code: '', stateId: '', ...initial });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group">
        <label className="form-label">State</label>
        <select className="form-input" value={form.stateId} onChange={(e) => setForm({ ...form, stateId: e.target.value })}>
          <option value="">Select State</option>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">District Name</label>
        <input className="form-input" placeholder="e.g. Kota" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">District Code</label>
        <input className="form-input" placeholder="e.g. KOTA" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={20} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSubmit(form)} disabled={loading}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving...</> : 'Save District'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Office Form ----
function OfficeForm({ initial = {}, districts, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({ name: '', address: '', districtId: '', ...initial });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group">
        <label className="form-label">District</label>
        <select className="form-input" value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })}>
          <option value="">Select District</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.state?.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Office Name</label>
        <input className="form-input" placeholder="e.g. Kota North Polling Station" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Address (optional)</label>
        <input className="form-input" placeholder="Ward 1, Kota North, Rajasthan" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSubmit(form)} disabled={loading}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving...</> : 'Save Office'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function AdminLocationsPage() {
  const [tab, setTab]         = useState('states'); // states | districts | offices
  const [states, setStates]   = useState([]);
  const [districts, setDistricts] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [modal, setModal]     = useState(null); // null | { type, data }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, o] = await Promise.all([
        locationsApi.getStates({ includeInactive: true }),
        locationsApi.getDistricts({ includeInactive: true }),
        locationsApi.getOffices({ includeInactive: true }),
      ]);
      setStates(s.data.data);
      setDistricts(d.data.data);
      setOffices(o.data.data);
    } catch { toast.error('Failed to load locations'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- State handlers ----
  async function handleCreateState(form) {
    setSaving(true);
    try {
      await locationsApi.createState(form);
      toast.success('State created');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleUpdateState(id, form) {
    setSaving(true);
    try {
      await locationsApi.updateState(id, form);
      toast.success('State updated');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleDeleteState(s) {
    if (!window.confirm(`Deactivate state "${s.name}"? This will also deactivate all districts and offices under it.`)) return;
    try { await locationsApi.deleteState(s.id); toast.success('State deactivated'); fetchAll(); }
    catch { toast.error('Failed'); }
  }

  // ---- District handlers ----
  async function handleCreateDistrict(form) {
    setSaving(true);
    try {
      await locationsApi.createDistrict(form);
      toast.success('District created');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleUpdateDistrict(id, form) {
    setSaving(true);
    try {
      await locationsApi.updateDistrict(id, form);
      toast.success('District updated');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleDeleteDistrict(d) {
    if (!window.confirm(`Deactivate district "${d.name}"?`)) return;
    try { await locationsApi.deleteDistrict(d.id); toast.success('District deactivated'); fetchAll(); }
    catch { toast.error('Failed'); }
  }

  // ---- Office handlers ----
  async function handleCreateOffice(form) {
    setSaving(true);
    try {
      await locationsApi.createOffice(form);
      toast.success('Office created');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleUpdateOffice(id, form) {
    setSaving(true);
    try {
      await locationsApi.updateOffice(id, form);
      toast.success('Office updated');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleDeleteOffice(o) {
    if (!window.confirm(`Deactivate office "${o.name}"?`)) return;
    try { await locationsApi.deleteOffice(o.id); toast.success('Office deactivated'); fetchAll(); }
    catch { toast.error('Failed'); }
  }

  const TABS = [
    { key: 'states',    label: 'States',    icon: Map,       count: states.length },
    { key: 'districts', label: 'Districts', icon: MapPin,    count: districts.length },
    { key: 'offices',   label: 'Offices',   icon: Building2, count: offices.length },
  ];

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// ADMIN PANEL</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>Location Management</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: tab, data: null })}>
          <Plus size={14} /> Add {tab === 'states' ? 'State' : tab === 'districts' ? 'District' : 'Office'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', color: tab === key ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.15s', marginBottom: -1 }}>
            <Icon size={14} />{label}
            <span className={`badge ${tab === key ? 'badge-blue' : 'badge-dim'}`} style={{ fontSize: 9 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Loading...</span>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              {/* States Tab */}
              {tab === 'states' && <>
                <thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Districts</th><th>Actions</th></tr></thead>
                <tbody>
                  {states.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{s.name}</td>
                      <td><span className="badge badge-blue">{s.code}</span></td>
                      <td><span className={`badge ${s.isActive ? 'badge-green' : 'badge-red'}`}>● {s.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>{s._count?.districts || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'states', data: s })}><Edit2 size={12} />Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteState(s)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>}

              {/* Districts Tab */}
              {tab === 'districts' && <>
                <thead><tr><th>Name</th><th>Code</th><th>State</th><th>Status</th><th>Offices</th><th>Actions</th></tr></thead>
                <tbody>
                  {districts.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{d.name}</td>
                      <td><span className="badge badge-dim">{d.code}</span></td>
                      <td><span className="badge badge-blue">{d.state?.code}</span></td>
                      <td><span className={`badge ${d.isActive ? 'badge-green' : 'badge-red'}`}>● {d.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>{d._count?.offices || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'districts', data: d })}><Edit2 size={12} />Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDistrict(d)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>}

              {/* Offices Tab */}
              {tab === 'offices' && <>
                <thead><tr><th>Name</th><th>District</th><th>State</th><th>Status</th><th>Cameras</th><th>Actions</th></tr></thead>
                <tbody>
                  {offices.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{o.name}</td>
                      <td>{o.district?.name}</td>
                      <td><span className="badge badge-blue">{o.district?.state?.code}</span></td>
                      <td><span className={`badge ${o.isActive ? 'badge-green' : 'badge-red'}`}>● {o.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>{o._count?.cameras || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'offices', data: o })}><Edit2 size={12} />Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOffice(o)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>}
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'states' && (
        <Modal title={modal.data ? 'Edit State' : 'Add State'} onClose={() => setModal(null)}>
          <StateForm initial={modal.data || {}} loading={saving}
            onClose={() => setModal(null)}
            onSubmit={(form) => modal.data ? handleUpdateState(modal.data.id, form) : handleCreateState(form)} />
        </Modal>
      )}
      {modal?.type === 'districts' && (
        <Modal title={modal.data ? 'Edit District' : 'Add District'} onClose={() => setModal(null)}>
          <DistrictForm initial={modal.data || {}} states={states} loading={saving}
            onClose={() => setModal(null)}
            onSubmit={(form) => modal.data ? handleUpdateDistrict(modal.data.id, form) : handleCreateDistrict(form)} />
        </Modal>
      )}
      {modal?.type === 'offices' && (
        <Modal title={modal.data ? 'Edit Office' : 'Add Office'} onClose={() => setModal(null)}>
          <OfficeForm initial={modal.data || {}} districts={districts} loading={saving}
            onClose={() => setModal(null)}
            onSubmit={(form) => modal.data ? handleUpdateOffice(modal.data.id, form) : handleCreateOffice(form)} />
        </Modal>
      )}
    </div>
  );
}
