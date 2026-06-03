import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { StatusBadge, EmptyState, Skeleton } from '@/components/common/UI';
import { toggleProviderAvailability, startLocationTracking, stopLocationTracking } from '@/services/socket';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  TrendingUp, Star, Briefcase, Wallet,
  ToggleLeft, ToggleRight, Clock, MapPin,
  Navigation, Radio, Crosshair, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE AREA CARD — GPS status + radius slider
// ══════════════════════════════════════════════════════════════════════════════
function ServiceAreaCard({ initialRadius = 10 }) {
  const [radius, setRadius] = useState(initialRadius);
  const [savedRadius, setSavedRadius] = useState(initialRadius);
  const [saving, setSaving] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'detecting' | 'live' | 'error'
  const watchIdRef = useRef(null);

  // Start watching GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    // Continuous watch (updates whenever position changes)
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setGpsCoords({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
        setGpsStatus('live');
      },
      (err) => {
        console.warn('[GPS Watch]', err.message);
        setGpsStatus('error');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    setGpsStatus('detecting');

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  async function saveRadius() {
    setSaving(true);
    try {
      const payload = { serviceRadius: radius };
      if (gpsCoords) {
        payload.lat = gpsCoords.lat;
        payload.lng = gpsCoords.lng;
      }
      await apiService.updateProviderLocation(payload);
      setSavedRadius(radius);
      toast.success(`Service radius updated to ${radius} km`);
    } catch (err) {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const gpsStatusConfig = {
    idle: { color: 'text-slate-400', bg: 'bg-slate-100', dot: 'bg-slate-400', label: 'GPS Idle' },
    detecting: { color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500 animate-pulse', label: 'Detecting…' },
    live: { color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500 animate-pulse', label: 'GPS Live' },
    error: { color: 'text-red-500', bg: 'bg-red-50', dot: 'bg-red-500', label: 'GPS Unavailable' },
  };
  const cfg = gpsStatusConfig[gpsStatus];

  return (
    <div className="card p-5 space-y-4">
      {/* Card header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Crosshair size={16} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Service Area</h3>
            <p className="text-xs text-slate-400">Jobs within your radius</p>
          </div>
        </div>
        {/* GPS Status pill */}
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* GPS coordinates */}
      {gpsStatus === 'live' && gpsCoords && (
        <div className="flex items-start gap-2 bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
          <Navigation size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-emerald-700">Current Location Locked</p>
            <p className="text-xs text-emerald-600 font-mono mt-0.5">
              {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
            </p>
            <p className="text-xs text-emerald-500 mt-0.5">±{Math.round(gpsCoords.accuracy)}m accuracy</p>
          </div>
        </div>
      )}
      {gpsStatus === 'error' && (
        <div className="bg-red-50 rounded-xl px-3 py-2 text-xs text-red-600 border border-red-100">
          📍 Enable GPS in your browser to automatically receive nearby jobs.
        </div>
      )}

      {/* Radius slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Job Radius</span>
          <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
            {radius} km
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={radius}
          onChange={e => setRadius(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
        />

        <div className="flex justify-between text-xs text-slate-400">
          <span>1 km</span>
          <span>25 km</span>
          <span>50 km</span>
        </div>
      </div>

      {/* Range stops quick-select */}
      <div className="flex gap-2 flex-wrap">
        {[5, 10, 15, 20, 30, 50].map(km => (
          <button
            key={km}
            type="button"
            onClick={() => setRadius(km)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
              radius === km
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-200 text-slate-500 hover:border-indigo-300 bg-white'
            }`}
          >
            {km} km
          </button>
        ))}
      </div>

      {/* Summary text */}
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Radio size={12} className="text-indigo-400 shrink-0" />
        You'll receive job requests within <strong className="text-slate-700">{radius} km</strong> of your current location.
      </p>

      {/* Save button */}
      <button
        type="button"
        onClick={saveRadius}
        disabled={saving || (radius === savedRadius && gpsStatus !== 'live')}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
          saving
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : radius === savedRadius
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
        }`}
      >
        {saving ? (
          'Saving…'
        ) : radius === savedRadius ? (
          <><Check size={14} /> Saved ({savedRadius} km)</>
        ) : (
          'Save Radius & Location'
        )}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export default function ProviderDashboard() {
  const user = useSelector(selectUser);
  const [profile, setProfile] = useState(null);
  const [todayJobs, setTodayJobs] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    Promise.all([
      apiService.getMyProfile(),
      apiService.getSchedule(dayjs().format('YYYY-MM-DD')),
      apiService.getEarnings('7d'),
    ]).then(([profileRes, scheduleRes, earningsRes]) => {
      setProfile(profileRes.data.data);
      setTodayJobs(scheduleRes.data.data);
      setEarnings(earningsRes.data.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleToggleOnline() {
    if (!profile) return;
    const newStatus = !profile.isOnline;
    setToggling(true);
    try {
      await apiService.toggleAvailability({ isOnline: newStatus });
      setProfile(p => ({ ...p, isOnline: newStatus }));
      toggleProviderAvailability(newStatus);
      if (newStatus) { startLocationTracking(); toast.success('You are now Online!'); }
      else { stopLocationTracking(); toast('You are now Offline'); }
    } catch { toast.error('Failed to update status'); }
    setToggling(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  );

  const approvalPending = profile?.approvalStatus !== 'approved';

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Approval banner */}
        {approvalPending && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-semibold text-amber-800">Account Under Review</p>
              <p className="text-sm text-amber-600 mt-0.5">Our team is verifying your details. You'll be notified once approved (usually within 24–48 hours).</p>
            </div>
          </div>
        )}

        {/* Profile + Online toggle */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl relative">
                {profile?.name?.[0]}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${profile?.isOnline ? 'bg-green-500' : 'bg-slate-400'}`} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{profile?.name}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Star size={13} className="text-amber-400 fill-amber-400" />
                  <span>{profile?.rating?.toFixed(1)} · {profile?.completedJobs} jobs</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                    { gold: 'bg-yellow-100 text-yellow-700', silver: 'bg-slate-100 text-slate-600', bronze: 'bg-orange-100 text-orange-700' }[profile?.tier]
                  }`}>{profile?.tier}</span>
                </div>
              </div>
            </div>

            {!approvalPending && (
              <button
                onClick={handleToggleOnline}
                disabled={toggling}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  profile?.isOnline ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
                } ${toggling ? 'opacity-50' : ''}`}
              >
                {profile?.isOnline ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {profile?.isOnline ? 'Online' : 'Offline'}
              </button>
            )}
          </div>
        </div>

        {/* ── Service Area Card (GPS + Radius) ── */}
        {!approvalPending && (
          <ServiceAreaCard initialRadius={profile?.serviceRadius || 10} />
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Wallet Balance', value: `₹${profile?.earnings?.walletBalance?.toLocaleString('en-IN') || 0}`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total Earnings', value: `₹${profile?.earnings?.totalEarnings?.toLocaleString('en-IN') || 0}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: "Today's Jobs", value: todayJobs.length, icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Rating', value: `${profile?.rating?.toFixed(1) || '—'} ⭐`, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`card p-4 ${bg} border-0`}>
              <Icon className={`${color} mb-2`} size={20} />
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Earnings chart */}
        {earnings?.weeklyEarnings?.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">7-Day Earnings</h3>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={earnings.weeklyEarnings} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="_id" tickFormatter={d => dayjs(d).format('DD')} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Earnings']} />
                <Area type="monotone" dataKey="amount" stroke="#2563EB" fill="#DBEAFE" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Today's schedule */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Today's Schedule</h3>
            <Link to="/provider/bookings" className="text-primary-600 text-sm font-medium">View all →</Link>
          </div>
          {todayJobs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No jobs scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayJobs.map(job => (
                <Link key={job._id} to={`/provider/bookings?tab=${job.status === 'assigned' ? 'pending' : job.status === 'completed' || job.status === 'cancelled' || job.status === 'paid' ? 'history' : 'active'}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 transition-colors">
                  <div className="text-center min-w-[48px]">
                    <p className="text-xs text-slate-400">{job.timeSlot?.from}</p>
                    <p className="text-xs text-slate-400">{job.timeSlot?.to}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{job.serviceId?.name}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <MapPin size={10} />
                      <span className="truncate">{job.serviceAddress?.city}</span>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
