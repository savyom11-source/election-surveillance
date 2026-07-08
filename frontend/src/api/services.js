// ============================================================
// API SERVICES — All API calls organized by resource
// ============================================================

import api from './client';

export const authApi = {
  login:          (data)          => api.post('/auth/login', data),
  logout:         (refreshToken)  => api.post('/auth/logout', { refreshToken }),
  refresh:        (refreshToken)  => api.post('/auth/refresh', { refreshToken }),
  me:             ()              => api.get('/auth/me'),
  changePassword: (data)          => api.post('/auth/change-password', data),
};

export const usersApi = {
  list:          (params)     => api.get('/users', { params }),
  get:           (id)         => api.get(`/users/${id}`),
  create:        (data)       => api.post('/users', data),
  update:        (id, data)   => api.patch(`/users/${id}`, data),
  deactivate:    (id)         => api.patch(`/users/${id}/deactivate`),
  activate:      (id)         => api.patch(`/users/${id}/activate`),
  resetPassword: (id, data)   => api.patch(`/users/${id}/reset-password`, data),
};

export const locationsApi = {
  // Tree
  getTree:        ()              => api.get('/locations/tree'),

  // States
  getStates:      (params)        => api.get('/locations/states', { params }),
  getState:       (id)            => api.get(`/locations/states/${id}`),
  createState:    (data)          => api.post('/locations/states', data),
  updateState:    (id, data)      => api.patch(`/locations/states/${id}`, data),
  deleteState:    (id)            => api.delete(`/locations/states/${id}`),

  // Districts
  getDistricts:   (params)        => api.get('/locations/districts', { params }),
  getDistrict:    (id)            => api.get(`/locations/districts/${id}`),
  createDistrict: (data)          => api.post('/locations/districts', data),
  updateDistrict: (id, data)      => api.patch(`/locations/districts/${id}`, data),
  deleteDistrict: (id)            => api.delete(`/locations/districts/${id}`),

  // Offices
  getOffices:     (params)        => api.get('/locations/offices', { params }),
  getOffice:      (id)            => api.get(`/locations/offices/${id}`),
  createOffice:   (data)          => api.post('/locations/offices', data),
  updateOffice:   (id, data)      => api.patch(`/locations/offices/${id}`, data),
  deleteOffice:   (id)            => api.delete(`/locations/offices/${id}`),
};

export const camerasApi = {
  list:    (params)   => api.get('/cameras', { params }),
  get:     (id)       => api.get(`/cameras/${id}`),
  stream:  (id)       => api.get(`/cameras/${id}/stream`),
  create:  (data)     => api.post('/cameras', data),
  update:  (id, data) => api.patch(`/cameras/${id}`, data),
  delete:  (id)       => api.delete(`/cameras/${id}`),
  bulkUpload: (formData) => api.post('/upload/cameras', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export const recordingsApi = {
  list:    (params) => api.get('/recordings', { params }),
  // Fixed: was playUrl, now aligned as play + playUrl both work
  play:    (id)     => api.get(`/recordings/${id}/play`),
  playUrl: (id)     => api.get(`/recordings/${id}/play`),
};
