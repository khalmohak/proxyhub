import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

// Attach JWT on every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('proxyhub_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 → clear token and redirect to login
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('proxyhub_token');
      localStorage.removeItem('proxyhub_identity');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login:  (data) => http.post('/auth/login', data),
  me:     ()     => http.get('/auth/me'),
};

export const settingsApi = {
  onboardingStatus: ()     => http.get('/settings/onboarding'),
  setup:            (data) => http.post('/settings/setup', data),
  get:              ()     => http.get('/settings'),
  update:           (data) => http.put('/settings', data),
  changePassword:   (data) => http.post('/settings/change-password', data),
};

export const proxiesApi = {
  list:         ()         => http.get('/proxies'),
  add:          (data)     => http.post('/proxies', data),
  bulk:         (formData) => http.post('/proxies/bulk', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  bulkText:     (data)     => http.post('/proxies/bulk', data),
  toggle:       (id)       => http.patch(`/proxies/${id}/toggle`),
  check:        (id)       => http.post(`/proxies/${id}/check`),
  checkAll:     ()         => http.post('/proxies/check-all'),
  syncMetadata: ()         => http.post('/proxies/sync-metadata'),
  syncStatus:   ()         => http.get('/proxies/sync-status'),
  remove:       (id)       => http.delete(`/proxies/${id}`),
};

export const logsApi = {
  list:   (params) => http.get('/logs', { params }),
  export: (params) => `/api/logs/export?${new URLSearchParams(params).toString()}`,
};

export const devicesApi = {
  list:   ()     => http.get('/devices'),
  create: (data) => http.post('/devices', data),
  toggle: (id)   => http.patch(`/devices/${id}/toggle`),
  remove: (id)   => http.delete(`/devices/${id}`),
};

export const statsApi = {
  get: () => http.get('/stats'),
};
