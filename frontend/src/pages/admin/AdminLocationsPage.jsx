// ============================================================
// ADMIN LOCATIONS PAGE — Manage States, Districts, Assemblies, Offices
// With Activate / Deactivate toggle
// Super Admin only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2, X, Building2, Map, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import { locationsApi } from '../../api/services';
import useAuthStore from '../../store/authStore';

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
  const [form, setForm] = useState({ name: '', code: '', targetOnlineCount: '', ...initial });
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
      <div className="form-group">
        <label className="form-label">Target Online Cameras (Padding)</label>
        <input className="form-input" type="number" placeholder="e.g. 70" value={form.targetOnlineCount ?? ''} onChange={(e) => setForm({ ...form, targetOnlineCount: e.target.value })} />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Leave blank for no padding. If set, offline cameras will fake buffer to hit this target.</span>
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

// ---- Assembly Form ----
function AssemblyForm({ initial = {}, districts, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({ name: '', districtId: '', ...initial });
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
        <label className="form-label">Assembly Name</label>
        <input className="form-input" placeholder="e.g. Kota North" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSubmit(form)} disabled={loading}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving...</> : 'Save Assembly'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Office Form ----
function OfficeForm({ initial = {}, assemblies, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({ name: '', address: '', assemblyId: '', ...initial });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group">
        <label className="form-label">Assembly</label>
        <select className="form-input" value={form.assemblyId} onChange={(e) => setForm({ ...form, assemblyId: e.target.value })}>
          <option value="">Select Assembly</option>
          {assemblies.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.district?.name}</option>)}
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
  const [tab, setTab]         = useState('states');
  const [states, setStates]   = useState([]);
  const [districts, setDistricts] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [actioning, setActioning] = useState(null);
  const [modal, setModal]     = useState(null);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, a, o] = await Promise.all([
        locationsApi.getStates({ includeInactive: true }),
        locationsApi.getDistricts({ includeInactive: true }),
        locationsApi.getAssemblies({ includeInactive: true }),
        locationsApi.getOffices({ includeInactive: true }),
      ]);
      setStates(s.data.data);
      setDistricts(d.data.data);
      setAssemblies(a.data.data);
      setOffices(o.data.data);
    } catch { toast.error('Failed to load locations'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- Delete Handlers ----
  async function handleDeleteState(s) {
    if (!window.confirm(`Are you sure you want to permanently delete State "${s.name}"?\nWARNING: This will delete ALL districts, assemblies, offices, and cameras inside it! This action cannot be undone.`)) return;
    setActioning(s.id);
    try {
      await locationsApi.deleteState(s.id);
      toast.success(`"${s.name}" deleted entirely`);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Action failed'); }
    finally { setActioning(null); }
  }

  async function handleDeleteDistrict(d) {
    if (!window.confirm(`Are you sure you want to permanently delete District "${d.name}"?\nWARNING: This will delete ALL assemblies, offices and cameras inside it! This action cannot be undone.`)) return;
    setActioning(d.id);
    try {
      await locationsApi.deleteDistrict(d.id);
      toast.success(`"${d.name}" deleted entirely`);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Action failed'); }
    finally { setActioning(null); }
  }

  async function handleDeleteAssembly(a) {
    if (!window.confirm(`Are you sure you want to permanently delete Assembly "${a.name}"?\nWARNING: This will delete ALL offices and cameras inside it! This action cannot be undone.`)) return;
    setActioning(a.id);
    try {
      await locationsApi.deleteAssembly(a.id);
      toast.success(`"${a.name}" deleted entirely`);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Action failed'); }
    finally { setActioning(null); }
  }

  async function handleDeleteOffice(o) {
    if (!window.confirm(`Are you sure you want to permanently delete Office "${o.name}"?\nWARNING: This will delete ALL cameras inside it! This action cannot be undone.`)) return;
    setActioning(o.id);
    try {
      await locationsApi.deleteOffice(o.id);
      toast.success(`"${o.name}" deleted entirely`);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Action failed'); }
    finally { setActioning(null); }
  }

  // ---- Create handlers ----
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

  async function handleCreateAssembly(form) {
    setSaving(true);
    try {
      await locationsApi.createAssembly(form);
      toast.success('Assembly created');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleUpdateAssembly(id, form) {
    setSaving(true);
    try {
      await locationsApi.updateAssembly(id, form);
      toast.success('Assembly updated');
      setModal(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  }

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

  const TABS = [
    { key: 'states',     label: 'States',     icon: Map,       count: states.length },
    { key: 'districts',  label: 'Districts',  icon: MapPin,    count: districts.length },
    { key: 'assemblies', label: 'Assemblies', icon: Flag,      count: assemblies.length },
    { key: 'offices',    label: 'Offices',    icon: Building2, count: offices.length },
  ];

  function ActionButtons({ item, onDelete, onEdit }) {
    const isActioning = actioning === item.id;
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>
          <Edit2 size={12} />Edit
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => onDelete(item)}
          disabled={isActioning}>
          {isActioning
            ? <div className="spinner" style={{ width: 12, height: 12 }} />
            : <><Trash2 size={12} />Delete</>}
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// ADMIN PANEL</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>Location Management</h1>
        </div>
        {!(tab === 'states' && !isSuperAdmin) && (
          <button className="btn btn-primary" onClick={() => setModal({ type: tab, data: null })}>
            <Plus size={14} /> Add {tab === 'states' ? 'State' : tab === 'districts' ? 'District' : tab === 'assemblies' ? 'Assembly' : 'Office'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', color: tab === key ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.15s', marginBottom: -1 }}>
            <Icon size={14} />{label}
            <span className={`badge ${tab === key ? 'badge-blue' : 'badge-dim'}`} style={{ fontSize: 9 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Loading...</span>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              {tab === 'states' && <>
                <thead><tr><th>Name</th><th>Code</th><th>Districts</th>{isSuperAdmin && <th>Actions</th>}</tr></thead>
                <tbody>
                  {states.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{s.name}</td>
                      <td><span className="badge badge-blue">{s.code}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>{s._count?.districts || 0}</td>
                      {isSuperAdmin && <td><ActionButtons item={s} onDelete={handleDeleteState} onEdit={(item) => setModal({ type: 'states', data: item })} /></td>}
                    </tr>
                  ))}
                </tbody>
              </>}

              {tab === 'districts' && <>
                <thead><tr><th>Name</th><th>Code</th><th>State</th><th>Assemblies</th><th>Actions</th></tr></thead>
                <tbody>
                  {districts.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{d.name}</td>
                      <td><span className="badge badge-dim">{d.code}</span></td>
                      <td><span className="badge badge-blue">{d.state?.code}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>{d._count?.assemblies || 0}</td>
                      <td><ActionButtons item={d} onDelete={handleDeleteDistrict} onEdit={(item) => setModal({ type: 'districts', data: item })} /></td>
                    </tr>
                  ))}
                </tbody>
              </>}

              {tab === 'assemblies' && <>
                <thead><tr><th>Name</th><th>District</th><th>State</th><th>Offices</th><th>Actions</th></tr></thead>
                <tbody>
                  {assemblies.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{a.name}</td>
                      <td>{a.district?.name}</td>
                      <td><span className="badge badge-blue">{a.district?.state?.code}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>{a._count?.offices || 0}</td>
                      <td><ActionButtons item={a} onDelete={handleDeleteAssembly} onEdit={(item) => setModal({ type: 'assemblies', data: item })} /></td>
                    </tr>
                  ))}
                </tbody>
              </>}

              {tab === 'offices' && <>
                <thead><tr><th>Name</th><th>Assembly</th><th>District</th><th>Cameras</th><th>Actions</th></tr></thead>
                <tbody>
                  {offices.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{o.name}</td>
                      <td>{o.assembly?.name}</td>
                      <td><span className="badge badge-dim">{o.assembly?.district?.name}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>{o._count?.cameras || 0}</td>
                      <td><ActionButtons item={o} onDelete={handleDeleteOffice} onEdit={(item) => setModal({ type: 'offices', data: item })} /></td>
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
      {modal?.type === 'assemblies' && (
        <Modal title={modal.data ? 'Edit Assembly' : 'Add Assembly'} onClose={() => setModal(null)}>
          <AssemblyForm initial={modal.data || {}} districts={districts} loading={saving}
            onClose={() => setModal(null)}
            onSubmit={(form) => modal.data ? handleUpdateAssembly(modal.data.id, form) : handleCreateAssembly(form)} />
        </Modal>
      )}
      {modal?.type === 'offices' && (
        <Modal title={modal.data ? 'Edit Office' : 'Add Office'} onClose={() => setModal(null)}>
          <OfficeForm initial={modal.data || {}} assemblies={assemblies} loading={saving}
            onClose={() => setModal(null)}
            onSubmit={(form) => modal.data ? handleUpdateOffice(modal.data.id, form) : handleCreateOffice(form)} />
        </Modal>
      )}
    </div>
  );
}
