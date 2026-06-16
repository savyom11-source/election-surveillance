// ============================================================
// API SERVICES — One function per endpoint
// ============================================================

import api from './client';

// ---- Auth ----
export const authApi = {
  login:          (body) => api.post('/auth/login', body),
  logout:         (refreshToken) => api.post('/auth/logout', { refreshToken }),
  me:             () => api.get('/auth/me'),
  changePassword: (body) => api.post('/auth/change-password', body),
};

// ---- Users ----
export const usersApi = {
  list:          (params) => api.get('/users', { params }),
  get:           (id) => api.get(`/users/${id}`),
  create:        (body) => api.post('/users', body),
  update:        (id, body) => api.patch(`/users/${id}`, body),
  deactivate:    (id) => api.patch(`/users/${id}/deactivate`),
  activate:      (id) => api.patch(`/users/${id}/activate`),
  resetPassword: (id, body) => api.patch(`/users/${id}/reset-password`, body),
};

// ---- Locations ----
export const locationsApi = {
  tree:            (params) => api.get('/locations/tree', { params }),
  // States
  getStates:       (params) => api.get('/locations/states', { params }),
  getState:        (id) => api.get(`/locations/states/${id}`),
  createState:     (body) => api.post('/locations/states', body),
  updateState:     (id, body) => api.patch(`/locations/states/${id}`, body),
  deleteState:     (id) => api.delete(`/locations/states/${id}`),
  // Districts
  getDistricts:    (params) => api.get('/locations/districts', { params }),
  getDistrict:     (id) => api.get(`/locations/districts/${id}`),
  createDistrict:  (body) => api.post('/locations/districts', body),
  updateDistrict:  (id, body) => api.patch(`/locations/districts/${id}`, body),
  deleteDistrict:  (id) => api.delete(`/locations/districts/${id}`),
  // Offices
  getOffices:      (params) => api.get('/locations/offices', { params }),
  getOffice:       (id) => api.get(`/locations/offices/${id}`),
  createOffice:    (body) => api.post('/locations/offices', body),
  updateOffice:    (id, body) => api.patch(`/locations/offices/${id}`, body),
  deleteOffice:    (id) => api.delete(`/locations/offices/${id}`),
};

// ---- Cameras ----
export const camerasApi = {
  list:   (params) => api.get('/cameras', { params }),
  get:    (id) => api.get(`/cameras/${id}`),
  stream: (id) => api.get(`/cameras/${id}/stream`),
  create: (body) => api.post('/cameras', body),
  update: (id, body) => api.patch(`/cameras/${id}`, body),
  delete: (id) => api.delete(`/cameras/${id}`),
};

// ---- Recordings ----
export const recordingsApi = {
  list:    (params) => api.get('/recordings', { params }),
  playUrl: (id) => api.get(`/recordings/${id}/play`),
};
