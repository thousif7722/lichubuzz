import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Navigation, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapRecenter({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, 15);
  }, [coords, map]);
  return null;
}

export default function CustomerTrackingModal({ booking, onClose }) {
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    const bCoords = booking.serviceAddress?.location?.coordinates;
    if (bCoords && bCoords.length === 2) {
      // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
      setCoords([bCoords[1], bCoords[0]]);
    }
  }, [booking]);

  if (!coords) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-5 border-b flex items-center justify-between bg-white relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Customer Location</h3>
              <p className="text-xs text-slate-500">{booking.serviceAddress?.line1}, {booking.serviceAddress?.city}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="h-[350px] relative w-full bg-slate-100">
          <MapContainer center={coords} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={coords}>
              <Popup>
                <div className="text-xs font-semibold">Customer's Service Location</div>
              </Popup>
            </Marker>
            <MapRecenter coords={coords} />
          </MapContainer>
        </div>

        <div className="p-5 bg-slate-50">
          <button 
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`, '_blank')}
            className="w-full btn-primary py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm"
          >
            <Navigation size={18} /> Open in Google Maps
          </button>
        </div>
      </div>
    </div>
  );
}
