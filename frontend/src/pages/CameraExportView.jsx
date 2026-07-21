import { useState, useEffect, useCallback } from 'react';
import { Download, Search, Play, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { camerasApi, locationsApi } from '../api/services';
import * as XLSX from 'xlsx';
import HLSPlayer from '../components/ui/HLSPlayer';

function VideoModal({ camera, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 800, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="card-header" style={{ justifyContent: 'space-between', padding: '16px 20px', background: 'var(--surface2)' }}>
          <div>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1 }}>{camera.name}</span>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Share Tech Mono', marginTop: 4 }}>
              {camera.office?.name} • {camera.office?.district?.name} • STREAM ID: {camera.streamUrl}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="card-body" style={{ padding: 0, height: 450, background: '#000', display: 'flex' }}>
          <HLSPlayer src={camera.hlsUrl} autoPlay={true} />
        </div>
      </div>
    </div>
  );
}

export default function CameraExportView() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [placementFilter, setPlacementFilter] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('');

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [offices, setOffices] = useState([]);

  useEffect(() => {
    locationsApi.getStates().then(r => setStates(r.data.data)).catch(() => {});
  }, []);

  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...(search && { streamId: search }) };
      if (statusFilter) params.status = statusFilter;
      if (placementFilter) params.placement = placementFilter;
      if (selectedState) params.stateId = selectedState;
      if (selectedDistrict) params.districtId = selectedDistrict;
      if (selectedOffice) params.officeId = selectedOffice;

      const res = await camerasApi.list(params);
      setCameras(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load cameras');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, placementFilter, selectedState, selectedDistrict, selectedOffice]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  async function handleStateChange(e) {
    const val = e.target.value;
    setSelectedState(val); setSelectedDistrict(''); setSelectedOffice(''); setPage(1);
    if (val) {
      const res = await locationsApi.getDistricts({ stateId: val });
      setDistricts(res.data.data);
    } else setDistricts([]);
    setOffices([]);
  }

  async function handleDistrictChange(e) {
    const val = e.target.value;
    setSelectedDistrict(val); setSelectedOffice(''); setPage(1);
    if (val) {
      const res = await locationsApi.getOffices({ districtId: val });
      setOffices(res.data.data);
    } else setOffices([]);
  }

  async function handleExport() {
    setExporting(true);
    const toastId = toast.loading('Compiling Data for Excel...');
    try {
      const params = { limit: 100000, ...(search && { streamId: search }) };
      if (statusFilter) params.status = statusFilter;
      if (placementFilter) params.placement = placementFilter;
      if (selectedState) params.stateId = selectedState;
      if (selectedDistrict) params.districtId = selectedDistrict;
      if (selectedOffice) params.officeId = selectedOffice;

      const res = await camerasApi.list(params);
      const allData = res.data.data;

      if (allData.length === 0) {
        toast.error('No data found to export', { id: toastId });
        return;
      }

      // Format strictly exactly as requested
      const excelData = allData.map(cam => ({
        'Assembly Name': cam.office?.name || 'N/A',
        'IN/OUT': cam.placement === 'INSIDE' ? 'IN' : cam.placement === 'OUTSIDE' ? 'OUT' : 'N/A',
        'Stream ID': cam.streamUrl || 'N/A',
        'Status': cam.status
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Camera Report");
      
      XLSX.writeFile(workbook, `Camera_Status_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel File Downloaded!', { id: toastId });
    } catch (err) {
      toast.error('Export failed', { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select className="form-input" style={{ width: 'auto' }} value={selectedState} onChange={handleStateChange}>
          <option value="">All States</option>
          {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={selectedDistrict} onChange={handleDistrictChange} disabled={!selectedState}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={selectedOffice} onChange={(e) => { setSelectedOffice(e.target.value); setPage(1); }} disabled={!selectedDistrict}>
          <option value="">All Assemblies (Offices)</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={placementFilter} onChange={(e) => { setPlacementFilter(e.target.value); setPage(1); }}>
          <option value="">All Placements</option>
          <option value="INSIDE">Inside (IN)</option>
          <option value="OUTSIDE">Outside (OUT)</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search camera or stream ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={exporting || loading}>
          <Download size={14} /> {exporting ? 'Exporting...' : 'Export .xlsx'}
        </button>
      </div>

      {/* Data Table */}
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Assembly Name</th>
                    <th>IN / OUT</th>
                    <th>Stream ID</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cameras.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>No cameras found matching filters</td></tr>
                  )}
                  {cameras.map(cam => (
                    <tr key={cam.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{cam.office?.name || '—'}</td>
                      <td>
                        {cam.placement && (
                          <span className={`badge badge-blue`}>
                            {cam.placement === 'INSIDE' ? 'IN' : 'OUT'}
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                        {cam.streamUrl}
                      </td>
                      <td>
                        <span className={`badge ${cam.status === 'ACTIVE' ? 'badge-green' : cam.status === 'INACTIVE' ? 'badge-red' : 'badge-yellow'}`}>
                          ● {cam.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm" 
                          style={{ background: cam.status === 'ACTIVE' ? 'rgba(0,255,157,0.1)' : 'transparent', color: cam.status === 'ACTIVE' ? '#00ff9d' : 'var(--text-dim)', border: '1px solid', borderColor: cam.status === 'ACTIVE' ? 'rgba(0,255,157,0.3)' : 'var(--border)' }}
                          onClick={() => setActiveVideo(cam)} disabled={cam.status !== 'ACTIVE'}>
                          <Play size={13} style={{ fill: cam.status === 'ACTIVE' ? '#00ff9d' : 'transparent' }} /> Play Feed
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ fontSize: 11, fontFamily: 'Share Tech Mono', color: 'var(--text-dim)', alignSelf: 'center' }}>
                  Page {page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <button className="btn btn-ghost btn-sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {activeVideo && <VideoModal camera={activeVideo} onClose={() => setActiveVideo(null)} />}
    </div>
  );
}
