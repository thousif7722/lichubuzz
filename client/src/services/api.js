import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach token ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle token refresh & errors ─────────────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle specific status codes
    if (error.response?.status === 429) {
      toast.error('Too many requests. Please slow down.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  }
);

function clearAuthAndRedirect() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

// ── Helper methods ─────────────────────────────────────────────────────────────
export const apiService = {
  // Auth
  sendOTP: (phone, role) => api.post('/auth/send-otp', { phone, role }),
  verifyOTP: (data) => api.post('/auth/verify-otp', data),
  activatePlus: () => api.post('/auth/plus'),

  // Services
  getServices: (params) => api.get('/services', { params }),
  getServiceById: (id) => api.get(`/services/${id}`),
  getCategories: () => api.get('/services/categories'),

  // Bookings
  getMyBookings: (params) => api.get('/bookings', { params }),
  getBooking: (id) => api.get(`/bookings/${id}`),
  createBooking: (data) => api.post('/bookings', data),
  acceptBooking: (id) => api.put(`/bookings/${id}/accept`),
  rejectBooking: (id, reason) => api.put(`/bookings/${id}/reject`, { reason }),
  startJob: (id, data) => api.put(`/bookings/${id}/start`, data),
  addMaterials: (id, data) => api.post(`/bookings/${id}/materials`, data),
  approveMaterials: (id) => api.put(`/bookings/${id}/materials/approve`),
  completeJob: (id, data) => api.put(`/bookings/${id}/complete`, data),
  cancelBooking: (id, reason) => api.put(`/bookings/${id}/cancel`, { reason }),
  getPaymentStatus: (bookingId) => api.get(`/payments/bookings/${bookingId}/status`),
  confirmCashPayment: (bookingId) => api.put(`/payments/bookings/${bookingId}/cash-confirm`),
  trackProvider: (id) => api.get(`/bookings/${id}/track`),
  downloadInvoice: (id) => api.get(`/bookings/${id}/invoice`, { responseType: 'blob' }),

  // Payments
  createOrder: (data) => api.post('/payments/create-order', data),
  verifyPayment: (data) => api.post('/payments/verify', data),
  getWallet: () => api.get('/payments/wallet'),
  withdraw: (amount) => api.post('/payments/withdraw', { amount }),

  // Provider
  getMyProfile: () => api.get('/providers/me'),
  updateProfile: (data) => api.put('/providers/me', data),
  uploadKYC: (formData) => api.post('/providers/me/kyc', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleAvailability: (data) => api.put('/providers/me/availability', data),
  updateServices: (serviceIds) => api.put('/providers/me/services', { serviceIds }),
  updateBankAccount: (data) => api.put('/providers/me/bank', data),
  getSchedule: (date) => api.get('/providers/me/schedule', { params: { date } }),
  getEarnings: (period) => api.get('/providers/me/earnings', { params: { period } }),
  getProviderPublic: (id) => api.get(`/providers/${id}`),
  updateProviderLocation: (data) => api.put('/providers/me/location', data),

  // Reviews
  createReview: (data) => api.post('/reviews', data),
  getProviderReviews: (providerId, params) => api.get(`/reviews/provider/${providerId}`, { params }),

  // Complaints
  createComplaint: (data) => api.post('/complaints', data),
  getMyComplaints: () => api.get('/complaints/my'),
  getComplaint: (ticketNumber) => api.get(`/complaints/${ticketNumber}`),

  // Notifications
  getNotifications: (params) => api.get('/notifications', { params }),
  markAllRead: () => api.put('/notifications/read-all'),
  markRead: (id) => api.put(`/notifications/${id}/read`),

  // Admin
  getDashboard: () => api.get('/admin/dashboard'),
  getAdminUsers: (params) => api.get('/admin/users', { params }),
  blockUser: (id, reason) => api.put(`/admin/users/${id}/block`, { reason }),
  unblockUser: (id) => api.put(`/admin/users/${id}/unblock`),
  getAdminProviders: (params) => api.get('/admin/providers', { params }),
  approveProvider: (id) => api.put(`/admin/providers/${id}/approve`),
  rejectProvider: (id, reason) => api.put(`/admin/providers/${id}/reject`, { reason }),
  warnProvider: (id, reason) => api.put(`/admin/providers/${id}/warn`, { reason }),
  getAdminBookings: (params) => api.get('/admin/bookings', { params }),
  assignBooking: (id, providerId) => api.put(`/admin/bookings/${id}/assign`, { providerId }),
  getFinancials: (params) => api.get('/admin/financials', { params }),
  getFraudAlerts: () => api.get('/admin/fraud/alerts'),
  createService: (data) => api.post('/admin/services', data),
  updateService: (id, data) => api.put(`/admin/services/${id}`, data),
  deleteService: (id) => api.delete(`/admin/services/${id}`),
  updateSurgePricing: (data) => api.put('/admin/pricing/surge', data),
  refundPayment: (data) => api.post('/payments/refund', data),
  // Admin Complaints
  getAdminComplaints: (params) => api.get('/admin/complaints', { params }),
  reassignComplaint: (id, action) => api.put(`/admin/complaints/${id}/reassign`, { action }),
  // Provider Wallet & Commission
  getProviderDues: (id) => api.get(`/admin/providers/${id}/dues`),
  adjustProviderWallet: (id, data) => api.put(`/admin/providers/${id}/wallet`, data),
  clearProviderDues: (id, data) => api.put(`/admin/providers/${id}/dues/clear`, data),
  // Team Management
  getAdminTeam: () => api.get('/admin/team'),
  createTeamMember: (data) => api.post('/admin/team', data),
  updateTeamMember: (id, data) => api.put(`/admin/team/${id}`, data),
  

  
  // Team Hierarchy
  createTeam: (data) => api.post('/admin/teams', data),
  getTeamHierarchy: () => api.get('/admin/teams/hierarchy'),
  
  // Announcements
  broadcastAnnouncement: (data) => api.post('/admin/announcements', data),
  
  // Attendance
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: () => api.post('/attendance/check-out'),
  getMyAttendance: (params) => api.get('/attendance/me', { params }),
};

export default api;
