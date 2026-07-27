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
      // Interceptor handles refresh. If we end up here, it completely failed.
      set({ isLoading: false, isAuthenticated: false, user: null });
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
