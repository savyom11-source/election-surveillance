import { useState, useEffect } from 'react';
import { Camera, Radio, VideoOff, Activity, RefreshCw, BarChart2, FileSpreadsheet } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import CameraExportView from './CameraExportView';

function StatPill({ icon: Icon, value, label, colorClass, bgColorClass, borderColorClass }) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 ${bgColorClass} ${borderColorClass} min-w-[120px] flex-1 shadow-lg`}>
      <Icon className={`w-8 h-8 mb-2 ${colorClass}`} />
      <div className={`text-3xl font-bold mb-1 ${colorClass} font-mono`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold text-center">{label}</div>
    </div>
  );
}

function MiniStats({ stats }) {
  return (
    <div className="flex gap-4 text-xs font-mono font-bold bg-dark-900/50 px-4 py-2 rounded-lg border border-dark-600">
      <span className="text-slate-300">TOTAL: {stats.total}</span>
      <span className="text-teal-400">LIVE: {stats.online}</span>
      <span className="text-slate-500">OFFLINE: {stats.notConnected}</span>
    </div>
  );
}

function RegionCard({ region }) {
  const { name, stats } = region;
  
  return (
    <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden flex flex-col">
      <div className="bg-blue-600/20 border-b border-blue-500/30 py-2 px-4 text-center">
        <h3 className="text-blue-400 font-bold tracking-wider text-sm">{name}</h3>
      </div>
      <div className="flex p-2 gap-1 flex-1">
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-800/50 rounded py-2">
          <div className="text-slate-300 font-mono text-lg font-bold">{stats.total}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-teal-500/10 rounded py-2">
          <div className="text-teal-400 font-mono text-lg font-bold">{stats.online}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-700/50 rounded py-2">
          <div className="text-slate-400 font-mono text-lg font-bold">{stats.notConnected}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-teal-600/10 rounded py-2">
          <div className="text-teal-500 font-mono text-lg font-bold">{stats.onceLive}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-indigo-500/10 rounded py-2">
          <div className="text-indigo-400 font-mono text-lg font-bold">{stats.activeToday}</div>
        </div>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useAuthStore();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stats/cameras');
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to load camera statistics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (!data) return null;

  const { overall, states } = data;

  // Calculate total number of offices to determine if we should show the breakdown
  const totalOffices = states.reduce((sum, state) => 
    sum + state.districts.reduce((dSum, dist) => dSum + dist.offices.length, 0)
  , 0);

  const showBreakdown = totalOffices > 1;

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full overflow-y-auto">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="text-blue-500" />
            Election Webcasting Overview
          </h1>
          <p className="text-slate-400 mt-1">Real-time status of all configured surveillance streams</p>
        </div>
        
        <button 
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm text-slate-300 transition-colors border border-dark-500"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {user?.role === 'SUPER_ADMIN' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <button 
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setActiveTab('overview')}
          >
            <BarChart2 size={16} /> Status Overview
          </button>
          <button 
            className={`btn ${activeTab === 'export' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setActiveTab('export')}
          >
            <FileSpreadsheet size={16} /> Camera Data Export
          </button>
        </div>
      )}

      {activeTab === 'export' && user?.role === 'SUPER_ADMIN' ? (
        <CameraExportView />
      ) : (
        <>
          {/* Overall Stats Pills */}
      <div className="flex flex-wrap gap-4 mb-10">
        <StatPill 
          icon={Camera} 
          value={overall.total} 
          label="Total"
          colorClass="text-slate-300"
          bgColorClass="bg-slate-800/40"
          borderColorClass="border-slate-700"
        />
        <StatPill 
          icon={Radio} 
          value={overall.online} 
          label="Online"
          colorClass="text-teal-400"
          bgColorClass="bg-teal-900/20"
          borderColorClass="border-teal-800/50"
        />
        <StatPill 
          icon={VideoOff} 
          value={overall.notConnected} 
          label="Not Connected"
          colorClass="text-slate-500"
          bgColorClass="bg-slate-900/40"
          borderColorClass="border-slate-800"
        />
        <StatPill 
          icon={Activity} 
          value={overall.onceLive} 
          label="Once Live"
          colorClass="text-teal-500"
          bgColorClass="bg-teal-900/10"
          borderColorClass="border-teal-900/30"
        />
        <StatPill 
          icon={RefreshCw} 
          value={overall.activeToday} 
          label="Active Today"
          colorClass="text-indigo-400"
          bgColorClass="bg-indigo-900/20"
          borderColorClass="border-indigo-800/50"
        />
      </div>

      {/* Hierarchical Breakdown - Only show if there's more than 1 office */}
      {showBreakdown && (
        <div className="flex flex-col gap-8">
          {states.map(state => (
            <div key={state.id} className="bg-dark-800/20 border border-dark-600 rounded-xl p-6">
              
              <div className="flex items-center justify-between mb-6 border-b border-dark-500 pb-4">
                <h2 className="text-xl font-bold text-blue-400 tracking-wider uppercase">{state.name} State</h2>
                <MiniStats stats={state.stats} />
              </div>

              <div className="flex flex-col gap-6 pl-4">
                {state.districts.map(district => (
                  <div key={district.id} className="border-l-2 border-dark-600 pl-6">
                    
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-300 uppercase tracking-wide">{district.name} District</h3>
                      <MiniStats stats={district.stats} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {district.offices.map(office => (
                        <RegionCard key={office.id} region={office} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

    </div>
  );
}
