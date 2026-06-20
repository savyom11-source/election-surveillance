// ============================================================
// ERROR BOUNDARY — Catches React render errors gracefully
// ============================================================

import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24, background: 'var(--bg)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={24} color="var(--danger)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 22, color: 'var(--text-bright)', textTransform: 'uppercase', marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, maxWidth: 400, lineHeight: 1.6 }}>
              An unexpected error occurred. Please refresh the page or contact your administrator.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre style={{ marginTop: 16, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, color: 'var(--danger)', textAlign: 'left', maxWidth: 600, overflow: 'auto' }}>
                {this.state.error?.toString()}
              </pre>
            )}
          </div>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
