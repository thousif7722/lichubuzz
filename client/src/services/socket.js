import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { store } from '@/store';
import { addNotification } from '@/store/slices/notificationSlice';
import { updateBookingStatus } from '@/store/slices/bookingSlice';

const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;

let socket = null;
let locationInterval = null;

export function connectSocket() {
  const token = localStorage.getItem('accessToken');
  if (!token || socket?.connected) return;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  // ── Connection events ──────────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Server-initiated disconnect — don't auto-reconnect
      socket.connect();
    }
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  // ── Booking events ─────────────────────────────────────────────────────────
  socket.on('booking:assigned', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'assigned' }));
    toast.success(data.message || 'Provider found!', { icon: '👷', duration: 5000 });
    showNotificationBanner(data.message);
  });

  socket.on('booking:accepted', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'accepted' }));
    toast.success(data.message || 'Provider accepted your booking!', { icon: '✅' });
  });

  socket.on('booking:status_update', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: data.status, endOtp: data.endOtp }));
    if (data.message) toast(data.message);
  });

  socket.on('booking:completed', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'completed' }));
    toast.success(data.message || 'Service completed! Proceed to payment.', { duration: 8000 });
  });

  socket.on('booking:paid', (data) => {
    store.dispatch(updateBookingStatus({ bookingId: data.bookingId, status: 'paid' }));
    toast.success(data.message || 'Payment successful!', { icon: '🎉' });
  });

  socket.on('booking:no_providers', (data) => {
    toast.error(data.message || 'No providers available in your area.', { duration: 8000 });
  });

  // ── Provider-specific events ───────────────────────────────────────────────
  socket.on('booking:new_request', (data) => {
    store.dispatch(addNotification({
      title: 'New Booking Request!',
      body: `${data.service?.name || 'Service'} at ${data.address?.area} — ₹${data.estimatedEarnings?.toFixed(0)}`,
      type: 'booking_update',
      isRead: false,
      createdAt: new Date().toISOString(),
    }));
    // Play alert sound
    playNotificationSound();
    toast(`New booking request! You have ${data.acceptTimeoutSeconds}s to accept.`, {
      icon: '🔔',
      duration: data.acceptTimeoutSeconds * 1000,
    });
  });

  socket.on('booking:expired', () => {
    toast('Booking request expired.', { icon: '⏰' });
  });

  socket.on('payment:received', (data) => {
    toast.success(data.message || `Payment received: ₹${data.earnings}`, { icon: '💰' });
  });

  // ── Real-time notifications ────────────────────────────────────────────────
  socket.on('notification:push', (data) => {
    store.dispatch(addNotification({ ...data, isRead: false, createdAt: new Date().toISOString() }));
  });

  return socket;
}

export function disconnectSocket() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

// ── Location tracking for providers ───────────────────────────────────────────
export function startLocationTracking() {
  if (!navigator.geolocation) return;
  if (locationInterval) clearInterval(locationInterval);

  const sendLocation = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (socket?.connected) {
          socket.emit('provider:location_update', {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy,
            heading: coords.heading,
            speed: coords.speed,
          });
        }
      },
      (err) => console.warn('[GPS] Error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  sendLocation();
  locationInterval = setInterval(sendLocation, 8000); // Every 8 seconds
}

export function stopLocationTracking() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}

// ── Chat helpers ───────────────────────────────────────────────────────────────
export function sendChatMessage(bookingId, message, type = 'text') {
  if (!socket?.connected) {
    toast.error('Not connected. Please check your internet.');
    return false;
  }
  socket.emit('chat:send', { bookingId, message, type });
  return true;
}

export function getChatHistory(bookingId, callback) {
  if (!socket?.connected) return;
  socket.emit('chat:history', { bookingId });
  socket.once('chat:history', callback);
}

export function sendTypingIndicator(bookingId, isTyping) {
  socket?.emit('chat:typing', { bookingId, isTyping });
}

export function onChatMessage(callback) {
  socket?.on('chat:message', callback);
  return () => socket?.off('chat:message', callback);
}

export function onProviderLocation(callback) {
  socket?.on('provider:location', callback);
  return () => socket?.off('provider:location', callback);
}

export function toggleProviderAvailability(isOnline) {
  socket?.emit('provider:toggle_availability', { isOnline });
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 880;
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch {}
}

function showNotificationBanner(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('ServiceHub', { body: message, icon: '/logo.svg' });
  }
}
