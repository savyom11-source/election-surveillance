// ============================================================
// ADMIN AUDIT LOG PAGE — View immutable access trail
// Super Admin only
// ============================================================

import { useState, useCallback } from 'react';
import { ClipboardList, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../api/client';

const ACTION_BADGE = {
  LOGIN:            'badge-green',
  LOGOUT:           'badge-dim',
  VIEW_STREAM:      'badge-blue',
  VIEW_RECORDING:   'badge-purple',
  CREATE_USER:      'badge-yellow',
  UPDATE_USER:      'badge-yellow',
  DELETE_USER:      'badge-red',
  ASSIGN_ROLE:      'badge-orange',
  CREATE_LOCATION:  'badge-green',
  UPDATE_LOCATION:  'badge-yellow',
  DELETE_LOCATION:  'badge-red',
  CREATE_CAMERA:    'badge-green',
  UPDATE_CAMERA:    'badge-yellow',
  DELETE_CAMERA:    'badge-red',
};

export default function AdminAuditPage() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch]     = useState('');
  const [action, setAction]     = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 30 };
      if (search) params.search = search;
      if (action) params.action = action;
      if (fromDate) params.from = new Date(fromDate).toISOString();
      if (toDate) params.to = new Date(toDate + 'T23:59:59').toISOString();

      const res = await api.get('/audit-logs', { params });
      setLogs(res.data.data);
      setPagination(res.data.pagination);
      setPage(p);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [search, action, fromDate, toDate]);

  const ACTIONS = [
    'LOGIN', 'LOGOUT', 'VIEW_STREAM', 'VIEW_RECORDING',
    'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'ASSIGN_ROLE',
    'CREATE_LOCATION', 'UPDATE_LOCATION', 'DELETE_LOCATION',
    'CREATE_CAMERA', 'UPDATE_CAMERA', 'DELETE_CAMERA',
  ];

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 3, marginBottom: 4 }}>// ADMIN PANEL</div>
        <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--text-bright)', textTransform: 'uppercase' }}>Audit Log</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>Immutable trail of all system actions for election validation</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Search User</label>
              <input className="form-input" placeholder="Name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Action</label>
              <select className="form-input" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All Actions</option>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
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
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => fetchLogs(1)} disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Loading...</> : <><Search size={14} />Search</>}
            </button>
            <button className="btn btn-ghost" onClick={() => { setSearch(''); setAction(''); setFromDate(''); setToDate(''); setLogs([]); setPagination(null); }}>Clear</button>
            <button className="btn btn-ghost btn-sm" onClick={() => fetchLogs(page)} style={{ marginLeft: 'auto' }}><RefreshCw size={13} /></button>
          </div>
        </div>
      </div>

      {/* Results */}
      {logs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <ClipboardList size={14} color="var(--accent)" />
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: 'var(--text-bright)', letterSpacing: 1, textTransform: 'uppercase' }}>
              {pagination?.total || 0} Log Entries
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Camera</th><th>IP Address</th><th>Details</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: 10, whiteSpace: 'nowrap' }}>
                      <div style={{ color: 'var(--text-bright)' }}>{format(new Date(log.createdAt), 'dd MMM yyyy')}</div>
                      <div style={{ color: 'var(--text-dim)' }}>{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: 12 }}>{log.user?.name}</div>
                      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)' }}>{log.user?.email}</div>
                    </td>
                    <td><span className={`badge ${ACTION_BADGE[log.action] || 'badge-dim'}`}>{log.action}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{log.camera?.name || '—'}</td>
                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)' }}>{log.ipAddress || '—'}</td>
                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)', maxWidth: 200 }}>
                      {log.metadata ? (
                        <span title={JSON.stringify(log.metadata, null, 2)} style={{ cursor: 'help', textDecoration: 'underline dotted' }}>
                          {Object.keys(log.metadata).slice(0, 2).join(', ')}...
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => fetchLogs(page - 1)}>← Prev</button>
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)' }}>Page {page} of {pagination.totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page === pagination.totalPages} onClick={() => fetchLogs(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {!loading && logs.length === 0 && pagination && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
          <ClipboardList size={40} opacity={0.3} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12 }}>No audit logs found for this search</p>
        </div>
      )}

      {!pagination && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
          <ClipboardList size={40} opacity={0.3} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12 }}>Select filters above and press Search</p>
        </div>
      )}
    </div>
  );
}
