import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gh_motive_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 — attempt token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('gh_motive_refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        localStorage.setItem('gh_motive_access_token', accessToken);
        localStorage.setItem('gh_motive_refresh_token', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — redirect to login
        localStorage.removeItem('gh_motive_access_token');
        localStorage.removeItem('gh_motive_refresh_token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

// ── Auth ────────────────────────────────────────────────────
export const authApi = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  refresh: (refreshToken) => apiClient.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => apiClient.post('/auth/logout', { refreshToken }),
  me: () => apiClient.get('/auth/me'),
  forgotPassword: (identifier) => apiClient.post('/auth/forgot-password', { identifier }),
  resetPassword: (token, newPassword) => apiClient.post('/auth/reset-password', { token, newPassword }),
};

// ── Users ────────────────────────────────────────────────────
export const usersApi = {
  getMe: () => apiClient.get('/users/me'),
  getById: (id) => apiClient.get(`/users/${id}`),
  list: (params) => apiClient.get('/users', { params }),
  updateMe: (data) => apiClient.patch('/users/me', data),
  changePassword: (data) => apiClient.patch('/users/me/password', data),
  uploadProfilePhoto: (file) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/users/me/profile-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deactivateMe: () => apiClient.patch('/users/me/deactivate'),
  sendEmailCode: () => apiClient.post('/users/me/verification/email/send'),
  confirmEmailCode: (code) => apiClient.post('/users/me/verification/email/confirm', { code }),
  sendPhoneCode: () => apiClient.post('/users/me/verification/phone/send'),
  confirmPhoneCode: (code) => apiClient.post('/users/me/verification/phone/confirm', { code }),
};

// ── Drivers ──────────────────────────────────────────────────
export const driversApi = {
  createProfile: (data) => apiClient.post('/drivers/profile', data),
  getMyProfile: () => apiClient.get('/drivers/profile'),
  getById: (id) => apiClient.get(`/drivers/${id}`),
  list: (params) => apiClient.get('/drivers', { params }),
};

// ── Owners ───────────────────────────────────────────────────
export const ownersApi = {
  createProfile: (data) => apiClient.post('/owners/profile', data),
  getMyProfile: () => apiClient.get('/owners/profile'),
  updateProfile: (data) => apiClient.patch('/owners/profile', data),
  getById: (id) => apiClient.get(`/owners/${id}`),
};

// ── Companies ────────────────────────────────────────────────
export const companiesApi = {
  create: (data) => apiClient.post('/companies', data),
  list: (params) => apiClient.get('/companies', { params }),
  getById: (id) => apiClient.get(`/companies/${id}`),
  mine: () => apiClient.get('/companies/mine'),
  listMembers: (companyId) => apiClient.get(`/companies/${companyId}/members`),
  addMember: (companyId, data) => apiClient.post(`/companies/${companyId}/members`, data),
  updateMemberRole: (companyId, memberId, data) => apiClient.patch(`/companies/${companyId}/members/${memberId}/role`, data),
  setMemberActive: (companyId, memberId, isActive) => apiClient.patch(`/companies/${companyId}/members/${memberId}/active`, { isActive }),
  createInvite: (companyId, data) => apiClient.post(`/companies/${companyId}/invites`, data),
  listInvites: (companyId) => apiClient.get(`/companies/${companyId}/invites`),
  resendInvite: (companyId, inviteId) => apiClient.post(`/companies/${companyId}/invites/${inviteId}/resend`),
  revokeInvite: (companyId, inviteId) => apiClient.post(`/companies/${companyId}/invites/${inviteId}/revoke`),
};

export const invitesApi = {
  resolve: (token) => apiClient.get(`/invites/${token}`),
  accept: (token, data) => apiClient.post(`/invites/${token}/accept`, data),
};

// ── Vehicles ─────────────────────────────────────────────────
export function resolveVehiclePhoto(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const vehiclesApi = {
  create: (data) => apiClient.post('/vehicles', data),
  list: (params) => apiClient.get('/vehicles', { params }),
  getById: (id) => apiClient.get(`/vehicles/${id}`),
  uploadPhotos: (id, files) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return apiClient.post(`/vehicles/${id}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  setPhotos: (id, imageUrls) => apiClient.patch(`/vehicles/${id}/photos`, { imageUrls }),
};

// ── Contracts ────────────────────────────────────────────────
export const contractsApi = {
  list:    (params) => apiClient.get('/contracts', { params }),
  getById: (id)     => apiClient.get(`/contracts/${id}`),
  create:  (data)   => apiClient.post('/contracts', data),
  accept:  (id)     => apiClient.post(`/contracts/${id}/accept`),
  updateStatus: (id, status) => apiClient.patch(`/contracts/${id}/status`, { status }),
  terminate: (id, reason) => apiClient.patch(`/contracts/${id}/terminate`, { reason }),
  getSchedule: (id) => apiClient.get(`/contracts/${id}/schedule`),
};

// ── Payments ─────────────────────────────────────────────────
export const paymentsApi = {
  list:    (params) => apiClient.get('/payments', { params }),
  getById: (id)     => apiClient.get(`/payments/${id}`),
  initiate:(data)   => apiClient.post('/payments/initiate', data),
};

// ── Settlements ───────────────────────────────────────────────
export const settlementsApi = {
  list:    (params) => apiClient.get('/settlements', { params }),
  getById: (id)     => apiClient.get(`/settlements/${id}`),
};

// ── Maintenance ───────────────────────────────────────────────
export const maintenanceApi = {
  list:    (params) => apiClient.get('/maintenance', { params }),
  getById: (id)     => apiClient.get(`/maintenance/${id}`),
  create:  (data)   => apiClient.post('/maintenance', data),
  update:  (id, data) => apiClient.patch(`/maintenance/${id}/status`, data),
};

// ── Disputes ─────────────────────────────────────────────────
export const disputesApi = {
  list:         (params)              => apiClient.get('/disputes', { params }),
  getById:      (id)                  => apiClient.get(`/disputes/${id}`),
  create:       (data)                => apiClient.post('/disputes', data),
  update:       (id, data)            => apiClient.patch(`/disputes/${id}`, data),
  updateStatus: (id, status, resolution) => apiClient.patch(`/disputes/${id}/status`, { status, resolution }),
  addMessage:   (id, data)            => apiClient.post(`/disputes/${id}/messages`, data),
  addEvidence:  (id, data)            => apiClient.post(`/disputes/${id}/evidence`, data),
  assign:       (id, userId)          => apiClient.patch(`/disputes/${id}/assign`, { userId }),
};

// ── Notifications ─────────────────────────────────────────────
export const notificationsApi = {
  list:    (params) => apiClient.get('/notifications', { params }),
  markRead:(id)     => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: ()   => apiClient.post('/notifications/read-all'),
};

// ── Compliance ────────────────────────────────────────────────
export const complianceApi = {
  list:    (params) => apiClient.get('/compliance', { params }),
  getById: (id)     => apiClient.get(`/compliance/${id}`),
  create:  (data)   => apiClient.post('/compliance', data),
  listForVehicle: (vehicleId) => apiClient.get(`/compliance/vehicle/${vehicleId}`),
  updateStatus: (id, data) => apiClient.patch(`/compliance/${id}/status`, data),
};

// ── Incidents ─────────────────────────────────────────────────
export const incidentsApi = {
  list:    (params) => apiClient.get('/incidents', { params }),
  getById: (id)     => apiClient.get(`/incidents/${id}`),
  create:  (data)   => apiClient.post('/incidents', data),
};

// ── Tracking ──────────────────────────────────────────────────
export const trackingApi = {
  getLastLocation: (vehicleId)         => apiClient.get(`/tracking/vehicles/${vehicleId}/location`),
  getHistory:      (vehicleId, params) => apiClient.get(`/tracking/vehicles/${vehicleId}/history`, { params }),
  getDevice:       (vehicleId)         => apiClient.get(`/tracking/vehicles/${vehicleId}/device`),
  registerDevice:  (data)              => apiClient.post('/tracking/devices', data),
  listDevices:     (params)            => apiClient.get('/tracking/devices', { params }),
  updateDeviceStatus: (id, status)     => apiClient.patch(`/tracking/devices/${id}/status`, { status }),
  listAlerts:      (params)            => apiClient.get('/tracking/alerts', { params }),
  markAlertRead:   (id)                => apiClient.patch(`/tracking/alerts/${id}/read`),
  issueCommand:    (vehicleId, data)   => apiClient.post(`/tracking/vehicles/${vehicleId}/commands`, data),
  listCommands:    (vehicleId)         => apiClient.get(`/tracking/vehicles/${vehicleId}/commands`),
  listGeofences:   ()                  => apiClient.get('/tracking/geofences'),
  createGeofence:  (data)              => apiClient.post('/tracking/geofences', data),
};

// ── Location share (owner only) ───────────────────────────────
export const locationShareApi = {
  create:    (data)  => apiClient.post('/tracking/shares', data),
  list:      ()      => apiClient.get('/tracking/shares'),
  revoke:    (id)    => apiClient.patch(`/tracking/shares/${id}/revoke`),
  // Public — no auth needed
  resolve:   (token) => apiClient.get(`/tracking/share/${token}`),
};

// ── Admin ────────────────────────────────────────────────────
export const adminApi = {
  announce: (data) => apiClient.post('/admin/announcements', data),
  // Users
  listUsers:      (params) => apiClient.get('/users', { params }),
  getUser:        (id)     => apiClient.get(`/users/${id}`),
  updateStatus:   (id, status) => apiClient.patch(`/users/${id}/status`, { status }),
  updateRole:     (id, role)   => apiClient.patch(`/users/${id}/role`, { role }),

  // Stats
  getStats: () => apiClient.get('/admin/stats'),

  // Drivers (admin)
  listDrivers:        (params) => apiClient.get('/admin/drivers', { params }),
  updateDriverStatus: (id, status) => apiClient.patch(`/admin/drivers/${id}/status`, { status }),

  // Owners (admin)
  listOwners:        (params) => apiClient.get('/admin/owners', { params }),
  updateOwnerStatus: (id, status) => apiClient.patch(`/admin/owners/${id}/status`, { status }),

  // Companies (admin)
  listCompanies:        (params) => apiClient.get('/admin/companies', { params }),
  updateCompanyStatus:  (id, status) => apiClient.patch(`/admin/companies/${id}/status`, { status }),

  // Vehicles (admin)
  listVehicles:        (params) => apiClient.get('/vehicles', { params }),
  updateVehicleStatus: (id, status) => apiClient.patch(`/admin/vehicles/${id}/status`, { status }),

  // Contracts (admin)
  listContracts: (params) => apiClient.get('/admin/contracts', { params }),

  // Payments (admin)
  listPayments: (params) => apiClient.get('/admin/payments', { params }),

  // Disputes (admin)
  listDisputes: (params) => apiClient.get('/admin/disputes', { params }),

  // Maintenance (admin)
  listMaintenance: (params) => apiClient.get('/admin/maintenance', { params }),

  // Payment provider (admin)
  getProviderStatus: ()           => apiClient.get('/payments/provider/status'),
  switchProvider:    (provider)   => apiClient.post('/payments/provider/switch', { provider }),

  // Tracking (admin)
  listTrackingDevices: (params)   => apiClient.get('/admin/tracking/devices', { params }),

  // Incidents (admin)
  listIncidents: (params)         => apiClient.get('/admin/incidents', { params }),

  // Compliance (admin)
  listCompliance: (params)        => apiClient.get('/admin/compliance', { params }),

  // Audit logs
  listAuditLogs: (params) => apiClient.get('/admin/audit', { params }),
};

// ── Health ───────────────────────────────────────────────────
export const healthApi = {
  check: () => apiClient.get('/health'),
};
