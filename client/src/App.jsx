import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectUserRole } from '@/store/slices/authSlice';
import { fetchServices, fetchCategories } from '@/store/slices/serviceSlice';
import { connectSocket, disconnectSocket } from '@/services/socket';
import LoadingScreen from '@/components/common/LoadingScreen';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const LoginPage        = lazy(() => import('@/pages/LoginPage'));
const HomePage         = lazy(() => import('@/pages/customer/HomePage'));
const ServiceDetail    = lazy(() => import('@/pages/customer/ServiceDetail'));
const BookingForm      = lazy(() => import('@/pages/customer/BookingForm'));
const BookingDetail    = lazy(() => import('@/pages/customer/BookingDetail'));
const MyBookings       = lazy(() => import('@/pages/customer/MyBookings'));
const TrackingPage     = lazy(() => import('@/pages/customer/TrackingPage'));
const PaymentPage      = lazy(() => import('@/pages/customer/PaymentPage'));
const PlusMembership   = lazy(() => import('@/pages/customer/PlusMembership'));
const ProfilePage      = lazy(() => import('@/pages/customer/ProfilePage'));
const ProviderDashboard= lazy(() => import('@/pages/provider/ProviderDashboard'));
const ProviderBookings = lazy(() => import('@/pages/provider/ProviderBookings'));
const ProviderEarnings = lazy(() => import('@/pages/provider/ProviderEarnings'));
const ProviderProfile  = lazy(() => import('@/pages/provider/ProviderProfile'));
const MaterialsBilling = lazy(() => import('@/pages/provider/MaterialsBilling'));
const AdminDashboard   = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers       = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminProviders   = lazy(() => import('@/pages/admin/AdminProviders'));
const AdminBookings    = lazy(() => import('@/pages/admin/AdminBookings'));
const AdminFinancials  = lazy(() => import('@/pages/admin/AdminFinancials'));
const AdminServices    = lazy(() => import('@/pages/admin/AdminServices'));
const AdminTeam        = lazy(() => import('@/pages/admin/AdminTeam'));
const AdminComplaints  = lazy(() => import('@/pages/admin/AdminComplaints'));
const AdminAnnouncements = lazy(() => import('@/pages/admin/AdminAnnouncements'));
const CategoryServicesPage = lazy(() => import('@/pages/customer/CategoryServicesPage'));
const PrivacyPolicy = lazy(() => import('@/pages/public/PrivacyPolicy'));
const Instructions = lazy(() => import('@/pages/public/Instructions'));
const Careers = lazy(() => import('@/pages/public/Careers'));
// ── Protected Route wrapper ────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const user = useSelector(selectUser);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }
  return children;
}

function getRoleHome(role) {
  if (role === 'admin' || role === 'staff') return '/admin';
  if (role === 'provider') return '/provider';
  return '/';
}

export default function App() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchServices());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      connectSocket();
      if ('Notification' in window) Notification.requestPermission();
    } else {
      disconnectSocket();
    }
    return () => {};
  }, [user]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
        {/* Public */}
        <Route path="/login" element={user ? <Navigate to={getRoleHome(user.role)} replace /> : <LoginPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/careers" element={<Careers />} />

        {/* Customer */}
        <Route path="/" element={<ProtectedRoute allowedRoles={['customer']}><HomePage /></ProtectedRoute>} />
        <Route path="/category/:categoryName" element={<ProtectedRoute allowedRoles={['customer']}><CategoryServicesPage /></ProtectedRoute>} />
        <Route path="/services/:id" element={<ProtectedRoute allowedRoles={['customer']}><ServiceDetail /></ProtectedRoute>} />
        <Route path="/book/:serviceId" element={<ProtectedRoute allowedRoles={['customer']}><BookingForm /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute allowedRoles={['customer']}><MyBookings /></ProtectedRoute>} />
        <Route path="/bookings/:id" element={<ProtectedRoute allowedRoles={['customer']}><BookingDetail /></ProtectedRoute>} />
        <Route path="/bookings/:id/track" element={<ProtectedRoute allowedRoles={['customer']}><TrackingPage /></ProtectedRoute>} />
        <Route path="/bookings/:id/pay" element={<ProtectedRoute allowedRoles={['customer']}><PaymentPage /></ProtectedRoute>} />
        <Route path="/plus" element={<ProtectedRoute allowedRoles={['customer']}><PlusMembership /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={['customer']}><ProfilePage /></ProtectedRoute>} />

        {/* Provider */}
        <Route path="/provider" element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboard /></ProtectedRoute>} />
        <Route path="/provider/bookings" element={<ProtectedRoute allowedRoles={['provider']}><ProviderBookings /></ProtectedRoute>} />
        <Route path="/provider/bookings/:id/materials" element={<ProtectedRoute allowedRoles={['provider']}><MaterialsBilling /></ProtectedRoute>} />
        <Route path="/provider/earnings" element={<ProtectedRoute allowedRoles={['provider']}><ProviderEarnings /></ProtectedRoute>} />
        <Route path="/provider/profile" element={<ProtectedRoute allowedRoles={['provider']}><ProviderProfile /></ProtectedRoute>} />

        {/* Admin & Staff */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/providers" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminProviders /></ProtectedRoute>} />
        <Route path="/admin/bookings" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminBookings /></ProtectedRoute>} />
        <Route path="/admin/financials" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminFinancials /></ProtectedRoute>} />
        <Route path="/admin/services" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminServices /></ProtectedRoute>} />
        <Route path="/admin/complaints" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminComplaints /></ProtectedRoute>} />
        <Route path="/admin/team" element={<ProtectedRoute allowedRoles={['admin']}><AdminTeam /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminAnnouncements /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={user ? getRoleHome(user.role) : '/login'} replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
