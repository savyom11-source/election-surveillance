// ============================================================
// APP LAYOUT — Sidebar + topbar shell
// ============================================================

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, MapPin, Video, Film, Users,
  ShieldCheck, LogOut, Menu, X, ChevronDown,
  Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const ROLE_LABELS = {
  SUPER_ADMIN:        { label: 'Super Admin',        color: 'badge-yellow' },
  STATE_ADMIN:        { label: 'State Admin',         color: 'badge-blue'   },
  DISTRICT_OBSERVER:  { label: 'District Observer',   color: 'badge-green'  },
  OFFICE_OBSERVER:    { label: 'Office Observer',     color: 'badge-gray'   },
};

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutGrid, label: 'Live Dashboard' },
  { to: '/locations',  icon: MapPin,     label: 'Locations'      },
  { to: '/recordings', icon: Film,       label: 'Recordings'     },
];

const ADMIN_ITEMS = [
  { to: '/admin/users',     icon: Users,  label: 'Users'    },
  { to: '/admin/locations', icon: MapPin, label: 'Manage Locations' },
  { to: '/admin/cameras',   icon: Video,  label: 'Cameras'  },
];

export default function AppLayout() {
  const { user, logout, hasRole } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS.OFFICE_OBSERVER;

  async function handleLogout() {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  }

  const Sidebar = ({ mobile = false }) => (
    <aside className={`flex flex-col h-full bg-dark-800 border-r border-dark-500
                       ${mobile ? 'w-full' : 'w-64'}`}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-dark-500">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg
                        bg-primary-900/50 border border-primary-700/50">
          <ShieldCheck className="w-4 h-4 text-primary-400" />
        </div>
        <div>
          <p className="font-condensed font-bold text-sm uppercase tracking-wider text-white">
            Election Surveillance
          </p>
          <p className="font-mono text-[10px] text-slate-500 tracking-widest">SECURE MONITORING</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600 px-3 mb-2">
          Monitoring
        </p>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            onClick={() => setSidebarOpen(false)}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}

        {isSuperAdmin && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600
                           px-3 mb-2 mt-5">
              Administration
            </p>
            {ADMIN_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
                onClick={() => setSidebarOpen(false)}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="px-3 py-3 border-t border-dark-500">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary-800 border border-primary-600
                          flex items-center justify-center text-primary-300 font-bold text-sm shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <span className={`${roleInfo.color} text-[10px] mt-0.5`}>{roleInfo.label}</span>
          </div>
          <button onClick={handleLogout} title="Logout"
            className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 w-72 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center gap-3 px-4 py-3 bg-dark-800
                            border-b border-dark-500 shrink-0">
          <button className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Notifications placeholder */}
          <button className="relative text-slate-500 hover:text-slate-300 transition-colors">
            <Bell className="w-5 h-5" />
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200
                         transition-colors text-sm">
              <div className="w-7 h-7 rounded-full bg-primary-800 border border-primary-600
                              flex items-center justify-center text-primary-300 font-bold text-xs">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="hidden sm:block font-medium">{user?.name}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 card shadow-xl z-20 py-1">
                <div className="px-3 py-2 border-b border-dark-500">
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm
                             text-red-400 hover:bg-dark-600 transition-colors">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
