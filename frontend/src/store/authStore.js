// ============================================================
// AUTH STORE — Zustand global state for authentication
// ============================================================

import { create } from 'zustand';
import { authApi } from '../api/services';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  // Called on app start — restores session from sessionStorage
  init: async () => {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await authApi.me();
      set({ user: data.data, isAuthenticated: true, isLoading: false });
    } catch {
      sessionStorage.clear();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    const { accessToken, refreshToken, user } = data.data;
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    const refreshToken = sessionStorage.getItem('refreshToken');
    try { await authApi.logout(refreshToken); } catch {}
    sessionStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  // Helper — check if user has a specific role
  hasRole: (...roles) => {
    const { user } = get();
    return user && roles.includes(user.role);
  },
}));

export default useAuthStore;
