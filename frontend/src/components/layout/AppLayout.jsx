// ============================================================
// APP LAYOUT — Sidebar + main content (plain inline styles)
// ============================================================

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, MapPin, Film, Users, Video, Activity,
  ShieldCheck, LogOut, Menu, Bell, ClipboardList, Map
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const ROLE_LABELS = {
  SUPER_ADMIN:       { label: 'Super Admin',      color: '#ffcc00' },
  STATE_ADMIN:       { label: 'State Admin',       color: '#00c8ff' },
  DISTRICT_OBSERVER: { label: 'District Observer', color: '#00ff9d' },
  OFFICE_OBSERVER:   { label: 'Office Observer',   color: '#c8dff0' },
};

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutGrid, label: 'Live Dashboard' },
  { to: '/stats',      icon: Activity,   label: 'Stats Overview' },
  { to: '/locations',  icon: MapPin,     label: 'Locations'      },
];

const ADMIN_ITEMS = [
  { to: '/admin/users',      icon: Users,         label: 'Users'     },
  { to: '/admin/cameras',    icon: Video,         label: 'Cameras'   },
  { to: '/admin/locations',  icon: Map,           label: 'Locations' },
  { to: '/admin/audit',      icon: ClipboardList, label: 'Audit Log' },
];

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS.OFFICE_OBSERVER;

  async function handleLogout() {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  }

  function SidebarContent() {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', width: 240,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={16} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 13, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Election Surveillance
            </div>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2 }}>
              SECURE MONITORING
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2, padding: '0 10px', marginBottom: 6 }}>
            Monitoring
          </div>

          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 5, marginBottom: 2,
                textDecoration: 'none', fontSize: 13, fontWeight: 600,
                color: isActive ? 'var(--accent)' : 'var(--text)',
                background: isActive ? 'rgba(0,200,255,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s',
              })}>
              <Icon size={15} />{label}
            </NavLink>
          ))}

          {isSuperAdmin && (
            <>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2, padding: '0 10px', margin: '16px 0 6px' }}>
                Administration
              </div>
              {ADMIN_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 5, marginBottom: 2,
                    textDecoration: 'none', fontSize: 13, fontWeight: 600,
                    color: isActive ? 'var(--warn)' : 'var(--text)',
                    background: isActive ? 'rgba(255,204,0,0.08)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--warn)' : '3px solid transparent',
                    transition: 'all 0.15s',
                  })}>
                  <Icon size={15} />{label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User info */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--surface2)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 10, color: roleInfo.color, fontFamily: 'Share Tech Mono' }}>
                {roleInfo.label}
              </div>
            </div>
            <button onClick={handleLogout} title="Logout"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <SidebarContent />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'relative', zIndex: 10 }}><SidebarContent /></div>
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>
            <Menu size={18} />
          </button>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 2 }}>
            ELECTION COMMISSION OF INDIA
          </div>
          <div style={{ flex: 1 }} />
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>
            <Bell size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: 11 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{user?.name}</span>
            <span style={{ fontSize: 9, color: roleInfo.color, fontFamily: 'Share Tech Mono' }}>{roleInfo.label}</span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
