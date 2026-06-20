// ============================================================
// AUTH STORE — Zustand store for authentication state
// Uses localStorage so login persists across browser refreshes
// ============================================================

import { create } from 'zustand';
import { authApi } from '../api/services';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  // Called once on app mount — restores session from localStorage
  init: async () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!accessToken || !refreshToken) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      const res = await authApi.me();
      set({ user: res.data.data, isAuthenticated: true, isLoading: false });
    } catch {
      // Access token expired — try refresh
      try {
        const res = await authApi.refresh(refreshToken);
        localStorage.setItem('accessToken', res.data.data.accessToken);
        localStorage.setItem('refreshToken', res.data.data.refreshToken);

        const me = await authApi.me();
        set({ user: me.data.data, isAuthenticated: true, isLoading: false });
      } catch {
        // Refresh failed — clear everything
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ isLoading: false, isAuthenticated: false, user: null });
      }
    }
  },

  // Login — store tokens in localStorage
  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    const { accessToken, refreshToken, user } = res.data.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    set({ user, isAuthenticated: true });
    return user;
  },

  // Logout — revoke token + clear localStorage
  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore logout errors */ }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  // Update user in store (e.g. after profile change)
  setUser: (user) => set({ user }),
}));

export default useAuthStore;
