// ============================================================
// APP — Router + auth guard + ErrorBoundary + toast provider
// ============================================================

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import ErrorBoundary from './components/ui/ErrorBoundary';

import AppLayout         from './components/layout/AppLayout';
import LoginPage         from './pages/auth/LoginPage';
import Dashboard         from './pages/Dashboard';
import StatsPage         from './pages/StatsPage';
import LocationsPage     from './pages/LocationsPage';

import AdminUsersPage    from './pages/admin/AdminUsersPage';
import AdminCamerasPage  from './pages/admin/AdminCamerasPage';
import AdminLocationsPage from './pages/admin/AdminLocationsPage';
import AdminAuditPage    from './pages/admin/AdminAuditPage';

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>LOADING...</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuthStore();
  return user?.role === 'SUPER_ADMIN' ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => { init(); }, [init]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1520',
              color: '#c8dff0',
              border: '1px solid #1a3050',
              fontFamily: "'Barlow', sans-serif",
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#00ff9d', secondary: '#080c10' } },
            error:   { iconTheme: { primary: '#ff4d6d', secondary: '#080c10' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"         element={<Dashboard />} />
            <Route path="stats"             element={<StatsPage />} />
            <Route path="locations"         element={<LocationsPage />} />

            <Route path="admin/users"       element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
            <Route path="admin/cameras"     element={<AdminRoute><AdminCamerasPage /></AdminRoute>} />
            <Route path="admin/locations"   element={<AdminRoute><AdminLocationsPage /></AdminRoute>} />
            <Route path="admin/audit"       element={<AdminRoute><AdminAuditPage /></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
