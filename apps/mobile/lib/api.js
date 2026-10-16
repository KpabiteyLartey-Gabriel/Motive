import axios from 'axios';
import SecureStore from './storage';
import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:3001/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

// Handle 401 — token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = response.data.data;
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', newRefresh);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;

// ── Auth ────────────────────────────────────────────────────
export const authApi = {
  register: (data) => apiClient.post('/auth/register', data),
  login:    (data) => apiClient.post('/auth/login', data),
  refresh:  (token) => apiClient.post('/auth/refresh', { refreshToken: token }),
  logout:   () => apiClient.post('/auth/logout'),
  me:       () => apiClient.get('/auth/me'),
  forgotPassword: (identifier) => apiClient.post('/auth/forgot-password', { identifier }),
  resetPassword:  (token, newPassword) => apiClient.post('/auth/reset-password', { token, newPassword }),
};

// ── Drivers ──────────────────────────────────────────────────
export const driversApi = {
  createProfile: (data) => apiClient.post('/drivers/profile', data),
  getMyProfile:  () => apiClient.get('/drivers/profile'),
  getById:       (id) => apiClient.get(`/drivers/${id}`),
};

// ── Owners ───────────────────────────────────────────────────
export const ownersApi = {
  createProfile: (data) => apiClient.post('/owners/profile', data),
  getMyProfile:  () => apiClient.get('/owners/profile'),
  updateProfile: (data) => apiClient.patch('/owners/profile', data),
  getById:       (id) => apiClient.get(`/owners/${id}`),
};

// ── Vehicles ─────────────────────────────────────────────────
export function resolveVehiclePhoto(url) {
  if (!url) return '';
  if (/^(https?:|data:)/i.test(url)) return url;
  const origin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const vehiclesApi = {
  list:    (params) => apiClient.get('/vehicles', { params }),
  getById: (id) => apiClient.get(`/vehicles/${id}`),
  create:  (data) => apiClient.post('/vehicles', data),
  setPhotos: (id, imageUrls) => apiClient.patch(`/vehicles/${id}/photos`, { imageUrls }),
};

// ── Contracts ────────────────────────────────────────────────
export const contractsApi = {
  list:      (params) => apiClient.get('/contracts', { params }),
  getById:   (id) => apiClient.get(`/contracts/${id}`),
  create:    (data) => apiClient.post('/contracts', data),
  accept:    (id) => apiClient.patch(`/contracts/${id}/accept`),
  terminate: (id, data) => apiClient.patch(`/contracts/${id}/terminate`, data),
};

// ── Payments ─────────────────────────────────────────────────
export const paymentsApi = {
  list:     (params) => apiClient.get('/payments', { params }),
  getById:  (id) => apiClient.get(`/payments/${id}`),
  initiate: (data) => apiClient.post('/payments/initiate', data),
};

// ── Notifications ────────────────────────────────────────────
export const notificationsApi = {
  list:    (params) => apiClient.get('/notifications', { params }),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
  registerPushToken: (data) => apiClient.post('/notifications/push-token', data),
  removePushToken: (token) => apiClient.delete(`/notifications/push-token/${encodeURIComponent(token)}`),
};

export const usersApi = {
  getMe:    () => apiClient.get('/users/me'),
  updateMe: (data) => apiClient.patch('/users/me', data),
  changePassword: (data) => apiClient.patch('/users/me/password', data),
  deactivateMe: () => apiClient.patch('/users/me/deactivate'),
  sendEmailCode:    () => apiClient.post('/users/me/verification/email/send'),
  confirmEmailCode: (code) => apiClient.post('/users/me/verification/email/confirm', { code }),
  sendPhoneCode:    () => apiClient.post('/users/me/verification/phone/send'),
  confirmPhoneCode: (code) => apiClient.post('/users/me/verification/phone/confirm', { code }),
  uploadProfilePhoto: (uri) => {
    const form = new FormData();
    const name = uri.split('/').pop() || 'profile.jpg';
    const type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    form.append('file', { uri, name, type });
    return apiClient.post('/users/me/profile-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Maintenance ──────────────────────────────────────────────
export const maintenanceApi = {
  list:   (params) => apiClient.get('/maintenance', { params }),
  create: (data) => apiClient.post('/maintenance', data),
  getById:(id) => apiClient.get(`/maintenance/${id}`),
};

// ── Disputes ─────────────────────────────────────────────────
export const disputesApi = {
  list:   (params) => apiClient.get('/disputes', { params }),
  create: (data) => apiClient.post('/disputes', data),
  getById:(id) => apiClient.get(`/disputes/${id}`),
  addMessage: (id, data) => apiClient.post(`/disputes/${id}/messages`, data),
};

// ── Incidents ────────────────────────────────────────────────
export const incidentsApi = {
  list:   (params) => apiClient.get('/incidents', { params }),
  create: (data) => apiClient.post('/incidents', data),
  getById:(id) => apiClient.get(`/incidents/${id}`),
};

// ── Compliance ───────────────────────────────────────────────
export const complianceApi = {
  listForVehicle: (vehicleId) => apiClient.get(`/compliance/vehicle/${vehicleId}`),
  listForDriver:  (driverId) => apiClient.get(`/compliance/driver/${driverId}`),
};

// ── Tracking ─────────────────────────────────────────────────
export const trackingApi = {
  getLastLocation: (vehicleId)         => apiClient.get(`/tracking/vehicles/${vehicleId}/location`),
  getHistory:      (vehicleId, params) => apiClient.get(`/tracking/vehicles/${vehicleId}/history`, { params }),
};

// ── Location share (owner only) ───────────────────────────────
export const locationShareApi = {
  create:  (data)  => apiClient.post('/tracking/shares', data),
  list:    ()      => apiClient.get('/tracking/shares'),
  revoke:  (id)    => apiClient.patch(`/tracking/shares/${id}/revoke`),
  // Public — no auth needed
  resolve: (token) => apiClient.get(`/tracking/share/${token}`),
};
