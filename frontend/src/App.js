// ============================================================
// APP — Router + auth guard + toast provider
// ============================================================

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';

import AppLayout    from './components/layout/AppLayout';
import LoginPage    from './pages/auth/LoginPage';
import Dashboard    from './pages/Dashboard';
import LocationsPage from './pages/LocationsPage';
import RecordingsPage from './pages/RecordingsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminCamerasPage from './pages/admin/AdminCamerasPage';

// Protected route — redirects to /login if not authenticated
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Admin-only route
function AdminRoute({ children }) {
  const { user } = useAuthStore();
  return user?.role === 'SUPER_ADMIN' ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => { init(); }, [init]);

  return (
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
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="locations"   element={<LocationsPage />} />
          <Route path="recordings"  element={<RecordingsPage />} />
          <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="admin/cameras" element={<AdminRoute><AdminCamerasPage /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
