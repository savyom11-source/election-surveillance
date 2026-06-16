// ============================================================
// ADMIN USERS PAGE — Create, view, edit, deactivate users
// Super Admin only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Shield, CheckCircle, XCircle, RefreshCw, KeyRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi, locationsApi } from '../../api/services';

const ROLE_INFO = {
  SUPER_ADMIN:       { label: 'Super Admin',       badge: 'badge-yellow' },
  STATE_ADMIN:       { label: 'State Admin',        badge: 'badge-blue'   },
  DISTRICT_OBSERVER: { label: 'District Observer',  badge: 'badge-green'  },
  OFFICE_OBSERVER:   { label: 'Office Observer',    badge: 'badge-dim'    },
};

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OFFICE_OBSERVER', scope: { stateIds: [], districtIds: [], officeIds: [] } });
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [offices, setOffices] = useState([]);

  useEffect(() => { locationsApi.getStates().then((r) => setStates(r.data.data)).catch(() => {}); }, []);

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleStateChange(e) {
    const stateId = e.target.value;
    set('scope', { stateIds: stateId ? [stateId] : [], districtIds: [], officeIds: [] });
    if (stateId) {
      const res = await locationsApi.getDistricts({ stateId });
      setDistricts(res.data.data);
    } else setDistricts([]);
    setOffices([]);
  }

  async function handleDistrictChange(e) {
    const districtId = e.target.value;
    set('scope', { ...form.scope, districtIds: districtId ? [districtId] : [], officeIds: [] });
    if (districtId) {
      const res = await locationsApi.getOffices({ districtId });
      setOffices(res.data.data);
    } else setOffices([]);
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await usersApi.create(form);
      toast.success('User created successfully');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create user');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group">
        <label className="form-label">Full Name</label>
        <input className="form-input" placeholder="e.g. John Observer" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Email</label>
        <input className="form-input" type="email" placeholder="user@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Password</label>
        <input className="form-input" type="password" placeholder="Min 8 characters" value={form.password} onChange={(e) => set('password', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Role</label>
        <select className="form-input" value={form.role} onChange={(e) => set('role', e.target.value)}>
          {Object.entries(ROLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Scope selectors */}
      {form.role !== 'SUPER_ADMIN' && (
        <>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1 }}>LOCATION SCOPE</div>
          <div className="form-group">
            <label className="form-label">State</label>
            <select className="form-input" onChange={handleStateChange}>
              <option value="">Select State</option>
              {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {form.role !== 'STATE_ADMIN' && districts.length > 0 && (
            <div className="form-group">
              <label className="form-label">District</label>
              <select className="form-input" onChange={handleDistrictChange}>
                <option value="">Select District</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {form.role === 'OFFICE_OBSERVER' && offices.length > 0 && (
            <div className="form-group">
              <label className="form-label">Office</label>
              <select className="form-input" onChange={(e) => set('scope', { ...form.scope, officeIds: e.target.value ? [e.target.value] : [] })}>
                <option value="">Select Office</option>
                {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Creating...</> : 'Create User'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRole]     = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [page, setPage]           = useState(1);
  const [actioning, setActioning] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...(search && { search }), ...(roleFilter && { role: roleFilter }) };
      const res = await usersApi.list(params);
      setUsers(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function toggleActive(user) {
    setActioning(user.id);
    try {
      if (user.isActive) {
        await usersApi.deactivate(user.id);
        toast.success(`${user.name} deactivated`);
      } else {
        await usersApi.activate(user.id);
        toast.success(`${user.name} activated`);
      }
      fetchUsers();
    } catch { toast.error('Action failed'); }
    finally { setActioning(null); }
  }

  async function resetPassword(user) {
    const pwd = prompt(`Enter new password for ${user.name} (min 8 chars):`);
    if (!pwd || pwd.length < 8) { if (pwd !== null) toast.error('Password too short'); return; }
    try {
      await usersApi.resetPassword(user.id, { newPassword: pwd });
      toast.success('Password reset successfully');
    } catch { toast.error('Failed to reset password'); }
  }

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// ADMIN PANEL</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>User Management</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New User</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="form-input" style={{ width: 'auto' }} value={roleFilter} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          {Object.entries(ROLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={fetchUsers}><RefreshCw size={13} /></button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, gap: 12 }}>
            <div className="spinner" /><span style={{ color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Loading users...</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name / Email</th><th>Role</th><th>Status</th><th>Scope</th><th>Last Login</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{u.name}</div>
                      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{u.email}</div>
                    </td>
                    <td><span className={`badge ${ROLE_INFO[u.role]?.badge || 'badge-dim'}`}><Shield size={9} />{ROLE_INFO[u.role]?.label || u.role}</span></td>
                    <td>
                      {u.isActive
                        ? <span className="badge badge-green"><CheckCircle size={9} />Active</span>
                        : <span className="badge badge-red"><XCircle size={9} />Inactive</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Share Tech Mono' }}>
                      {u.role === 'SUPER_ADMIN' ? <span className="badge badge-yellow">All Access</span>
                        : u.userScopes.length === 0 ? <span className="badge badge-red">No Scope</span>
                        : u.userScopes.slice(0, 2).map((s, i) => (
                          <div key={i} style={{ fontSize: 10 }}>{s.state?.name || s.district?.name || s.office?.name || '—'}</div>
                        ))}
                    </td>
                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => toggleActive(u)} disabled={actioning === u.id}>
                          {u.isActive ? <XCircle size={12} /> : <CheckCircle size={12} />}
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(u)} title="Reset Password">
                          <KeyRound size={12} />
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
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)' }}>Page {page} of {pagination.totalPages} ({pagination.total} users)</span>
            <button className="btn btn-ghost btn-sm" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {showCreate && <Modal title="Create New User" onClose={() => setShowCreate(false)}><CreateUserModal onClose={() => setShowCreate(false)} onCreated={fetchUsers} /></Modal>}
    </div>
  );
}
