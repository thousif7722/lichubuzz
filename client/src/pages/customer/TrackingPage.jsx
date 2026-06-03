// TrackingPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiService } from '@/services/api';
import { onProviderLocation } from '@/services/socket';
import Header from '@/components/common/Header';
import { Phone, MessageCircle, MapPin, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' });

const providerIcon = L.divIcon({ html: `<div style="background:#2563EB;color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(37,99,235,0.5);border:3px solid white">🔧</div>`, iconSize: [40, 40], iconAnchor: [20, 20], className: '' });
const customerIcon = L.divIcon({ html: `<div style="background:#16A34A;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(22,163,74,0.5);border:3px solid white">🏠</div>`, iconSize: [36, 36], iconAnchor: [18, 18], className: '' });

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom(), { animate: true }); }, [center]);
  return null;
}

export default function TrackingPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [providerLocation, setProviderLocation] = useState(null);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    apiService.getBooking(id).then(res => {
      const b = res.data.data.booking;
      setBooking(b);
      if (b.providerId?.currentLocation?.coordinates) {
        const [lng, lat] = b.providerId.currentLocation.coordinates;
        setProviderLocation({ lat, lng });
      }
    });

    const unsub = onProviderLocation((data) => {
      setProviderLocation({ lat: data.lat, lng: data.lng });
      setEta(Math.ceil(Math.random() * 10 + 3)); // Mock ETA in minutes
    });

    // Poll fallback every 15s
    const poll = setInterval(async () => {
      const res = await apiService.trackProvider(id).catch(() => null);
      if (res?.data?.data) {
        const { lat, lng } = res.data.data;
        setProviderLocation({ lat, lng });
      }
    }, 15000);

    return () => { unsub(); clearInterval(poll); };
  }, [id]);

  const serviceCoords = booking?.serviceAddress?.location?.coordinates;
  const servicePosition = serviceCoords ? [serviceCoords[1], serviceCoords[0]] : [12.9716, 77.5946];
  const providerPosition = providerLocation ? [providerLocation.lat, providerLocation.lng] : null;
  const mapCenter = providerPosition || servicePosition;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Header />
      <div className="pt-16 flex-1 flex flex-col">
        {/* Map */}
        <div className="flex-1 relative" style={{ minHeight: '60vh' }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            <MapUpdater center={providerPosition} />
            {providerPosition && (
              <Marker position={providerPosition} icon={providerIcon}>
                <Popup>Provider location</Popup>
              </Marker>
            )}
            <Marker position={servicePosition} icon={customerIcon}>
              <Popup>Your location</Popup>
            </Marker>
          </MapContainer>

          {/* Live badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-2 shadow-elevated flex items-center gap-2 z-[400]">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold text-slate-800">Live Tracking</span>
          </div>
        </div>

        {/* Bottom panel */}
        <div className="bg-white rounded-t-3xl shadow-elevated p-6 space-y-4">
          {booking?.providerId && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl">
                  {booking.providerId.name?.[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{booking.providerId.name}</p>
                  <p className="text-sm text-slate-500">⭐ {booking.providerId.rating} · Your Service Provider</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`tel:${booking.providerId.phone}`} className="w-11 h-11 bg-primary-600 rounded-full flex items-center justify-center text-white shadow">
                  <Phone size={18} />
                </a>
              </div>
            </div>
          )}

          <div className="bg-primary-50 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Navigation className="text-primary-600" size={20} />
              <div>
                <p className="font-semibold text-slate-800">
                  {booking?.status === 'in_progress' ? 'Service in progress' : 'Provider is on the way'}
                </p>
                {eta && <p className="text-sm text-slate-500">Estimated arrival: {eta} min</p>}
                {!providerPosition && <p className="text-sm text-slate-400">Waiting for location update…</p>}
              </div>
            </div>
            <div className="text-2xl">{booking?.status === 'in_progress' ? '🔧' : '🚗'}</div>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <MapPin size={14} />
            <span className="truncate">{booking?.serviceAddress?.line1}, {booking?.serviceAddress?.city}</span>
          </div>

          <Link to={`/bookings/${id}`} className="btn-secondary w-full text-center block py-3">View Booking Details</Link>
        </div>
      </div>
    </div>
  );
}
