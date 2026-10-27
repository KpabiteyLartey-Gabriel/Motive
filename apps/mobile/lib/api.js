import axios from 'axios';
import { Platform } from 'react-native';
import SecureStore from './storage';
import Constants from 'expo-constants';

function resolveApiUrl() {
  const extra = Constants.expoConfig?.extra?.apiUrl;
  if (extra) return extra;
  // In development the phone loads this bundle from the dev computer over
  // Wi-Fi — reach the backend on that same address. This keeps sign-in
  // working when the computer's IP changes (new network, hotspot, DHCP),
  // instead of failing on a stale hard-coded IP.
  if (__DEV__) {
    // On web, reach the backend on the same host the page was loaded from —
    // never a stale IP saved in .env.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:3001/api/v1`;
    }
    const hostUri = Constants.expoConfig?.hostUri || '';
    const host = hostUri.split(':')[0];
    if (host) return `http://${host}:3001/api/v1`;
  }
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
}

const API_URL = resolveApiUrl();

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
  refresh:  (refreshToken) => apiClient.post('/auth/refresh-token', { refreshToken }),
  forgotPassword: (identifier) => apiClient.post('/auth/forgot-password', { identifier }),
  resetPassword:  (token, newPassword) => apiClient.post('/auth/reset-password', { token, newPassword }),
};

// ── Drivers ──────────────────────────────────────────────────
export const driversApi = {
  getMyProfile:  () => apiClient.get('/drivers/profile'),
  updateProfile: (data) => apiClient.patch('/drivers/profile', data),
  uploadDocument: (uri, type, expiryDate) => {
    const form = new FormData();
    const name = uri.split('/').pop() || 'document.jpg';
    const mime = name.toLowerCase().endsWith('.png') ? 'image/png' : name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    form.append('file', { uri, name, type: mime });
    form.append('type', type);
    if (expiryDate) form.append('expiryDate', expiryDate);
    return apiClient.post('/drivers/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Owners ───────────────────────────────────────────────────
export const ownersApi = {
  getMyProfile:  () => apiClient.get('/owners/profile'),
  updateProfile: (data) => apiClient.patch('/owners/profile', data),
};

// ── Vehicles ─────────────────────────────────────────────────
export function resolveVehiclePhoto(url) {
  if (!url) return '';
  if (/^(https?:|data:)/i.test(url)) return url;
  const origin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const companiesApi = {
  list: (params) => apiClient.get('/companies', { params }),
};

export const vehiclesApi = {
  list:    (params) => apiClient.get('/vehicles', { params }),
  create:  (data) => apiClient.post('/vehicles', data),
  uploadPhotos: async (id, uri) => {
    const form = new FormData();
    const name = (uri || '').split('/').pop() || 'vehicle.jpg';
    if (/^(blob:|data:)/.test(uri || '')) {
      // Web pickers hand back blob:/data: URIs — they must become a real File.
      const blob = await (await fetch(uri)).blob();
      form.append('files', new File([blob], name === 'vehicle.jpg' ? 'vehicle.png' : name, { type: blob.type || 'image/png' }));
    } else {
      const type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      form.append('files', { uri, name, type });
    }
    return apiClient.post(`/vehicles/${id}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  setPhotos: (id, imageUrls) => apiClient.patch(`/vehicles/${id}/photos`, { imageUrls }),
  myRenewals: () => apiClient.get('/vehicles/me/renewals'),
  updateRenewals: (id, data) => apiClient.patch(`/vehicles/${id}/renewals`, data),
  updateStatus: (id, status) => apiClient.patch(`/vehicles/${id}/status`, { status }),
  changeOperatingModel: (id, operatingModel, managingCompanyId) => apiClient.patch(`/vehicles/${id}/operating-model`, { operatingModel, ...(managingCompanyId ? { managingCompanyId } : {}) }),
  getPendingModelChange: (id) => apiClient.get(`/vehicles/${id}/operating-model-request`),
  decideModelChange: (id, requestId, approve) => apiClient.post(`/vehicles/${id}/operating-model-request/${requestId}/decision`, { approve }),
  updateDetails: (id, data) => apiClient.patch(`/vehicles/${id}/details`, data),
  uploadEvidence: (id, kind, formData) => apiClient.post(`/vehicles/${id}/verification/evidence/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  submitVerification: (id) => apiClient.post(`/vehicles/${id}/verification/submit`, {}),
};

// ── Contracts ────────────────────────────────────────────────
export const contractsApi = {
  list:      (params) => apiClient.get('/contracts', { params }),
  create:    (data) => apiClient.post('/contracts', data),
  accept:    (id) => apiClient.post(`/contracts/${id}/accept`),
  confirmCode: (id, code) => apiClient.post(`/contracts/${id}/confirm-code`, { code }),
  share:     (id, chatUsername) => apiClient.post(`/contracts/${id}/share`, { chatUsername }),
  attach:    (id, vehicleId) => apiClient.post(`/contracts/${id}/attach`, { vehicleId }),
  award:     (id, chatUsername) => apiClient.post(`/contracts/${id}/award`, { chatUsername }),
  getSchedule: (id) => apiClient.get(`/contracts/${id}/schedule`),
};

export const marketplaceApi = {
  explore: () => apiClient.get('/marketplace/explore'),
  expressInterest: (vehicleId, message) => apiClient.post(`/marketplace/vehicles/${vehicleId}/interest`, { message: message || undefined }),
  vehicleInterests: (vehicleId) => apiClient.get(`/marketplace/vehicles/${vehicleId}/interests`),
  myInterests: () => apiClient.get('/marketplace/my-interests'),
  approveInterest: (interestId) => apiClient.post(`/marketplace/interests/${interestId}/approve`),
  declineInterest: (interestId) => apiClient.post(`/marketplace/interests/${interestId}/decline`),
  releaseInterest: (interestId) => apiClient.post(`/marketplace/interests/${interestId}/release`),
  threads: () => apiClient.get('/marketplace/threads'),
  messages: (threadId) => apiClient.get(`/marketplace/threads/${threadId}/messages`),
  sendMessage: (threadId, data) => apiClient.post(`/marketplace/threads/${threadId}/messages`, data),
  uploadAttachment: (threadId, formData) => apiClient.post(`/marketplace/threads/${threadId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  generateAccessCode: (contractId) => apiClient.post(`/marketplace/contracts/${contractId}/access-code`),
  chatUsername: () => apiClient.get('/marketplace/chat/username'),
  setChatUsername: (chatUsername) => apiClient.post('/marketplace/chat/username', { chatUsername }),
  searchChatUsers: (q) => apiClient.get('/marketplace/chat/search', { params: { q } }),
  startDirectThread: (chatUsername) => apiClient.post('/marketplace/chat/direct-thread', { chatUsername }),
};

// ── Payments ─────────────────────────────────────────────────
export const paymentsApi = {
  list:     (params) => apiClient.get('/payments', { params }),
  initiate: (data) => apiClient.post('/payments', data),
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

// ── Accounts (roles a User holds: Driver, Owner, ...) ────────
export const accountsApi = {
  me: () => apiClient.get('/accounts/me'),
  // Paid Driver/Owner creation: start (code) -> confirm -> pay -> created.
  creationCharges: () => apiClient.get('/accounts/me/creation/charges'),
  startCreation: (kind) => apiClient.post(`/accounts/me/creation/${kind}/start`),
  confirmCreation: (kind, code) => apiClient.post(`/accounts/me/creation/${kind}/confirm`, { code }),
  payCreation: (kind, data) => apiClient.post(`/accounts/me/creation/${kind}/pay`, data),
  creationStatus: (kind) => apiClient.get(`/accounts/me/creation/${kind}/status`),
};

// ── Maintenance ──────────────────────────────────────────────
export const servicesApi = {
  list: (params) => apiClient.get('/services', { params }),
  mine: () => apiClient.get('/services/mine'),
  create: (data) => apiClient.post('/services', data),
  update: (id, data) => apiClient.patch(`/services/${id}`, data),
  remove: (id) => apiClient.delete(`/services/${id}`),
  request: (id, data) => apiClient.post(`/services/${id}/request`, data),
  myRequests: () => apiClient.get('/services/requests/mine'),
  incomingRequests: () => apiClient.get('/services/requests/incoming'),
  updateRequestStatus: (id, data) => apiClient.patch(`/services/requests/${id}/status`, data),
};

export const maintenanceApi = {
  list:   (params) => apiClient.get('/maintenance', { params }),
  create: (data) => apiClient.post('/maintenance', data),
};

// ── Disputes ─────────────────────────────────────────────────
export const disputesApi = {
  list:   (params) => apiClient.get('/disputes', { params }),
  create: (data) => apiClient.post('/disputes', data),
};

// ── Incidents ────────────────────────────────────────────────
export const incidentsApi = {
  list:   (params) => apiClient.get('/incidents', { params }),
  create: (data) => apiClient.post('/incidents', data),
};

// ── Compliance ───────────────────────────────────────────────
export const complianceApi = {
  listForVehicle: (vehicleId) => apiClient.get(`/compliance/vehicle/${vehicleId}`),
};

// ── Tracking ─────────────────────────────────────────────────
export const trackingApi = {
  getLastLocation: (vehicleId)         => apiClient.get(`/tracking/vehicles/${vehicleId}/location`),
};

// ── Location share (owner only) ───────────────────────────────
export const locationShareApi = {
  create:  (data)  => apiClient.post('/tracking/shares', data),
  list:    ()      => apiClient.get('/tracking/shares'),
  revoke:  (id)    => apiClient.patch(`/tracking/shares/${id}/revoke`),
  // Public — no auth needed
  resolve: (token) => apiClient.get(`/tracking/share/${token}`),
};
