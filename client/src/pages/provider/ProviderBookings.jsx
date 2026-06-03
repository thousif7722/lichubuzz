import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { StatusBadge, EmptyState } from '@/components/common/UI';
import {
  CheckCircle, XCircle, MapPin, Clock, DollarSign,
  Wrench, CheckCircle2, X, ChevronRight, AlertCircle,
  Banknote, CreditCard, Hourglass, IndianRupee, Navigation, Map
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { getSocket } from '@/services/socket';
import CustomerTrackingModal from '@/components/provider/CustomerTrackingModal';

// ══════════════════════════════════════════════════════════════════════════════
// COMPLETE JOB MODAL — Rapido-style 4-digit PIN entry
// ══════════════════════════════════════════════════════════════════════════════
function CompleteJobModal({ booking, onClose, onCompleted }) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [workNote, setWorkNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const fullPin = pin.join('');
  const isComplete = fullPin.length === 4;

  function handleDigit(idx, val) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...pin];
    next[idx] = digit;
    setPin(next);
    setError('');
    if (digit && idx < 3) inputRefs[idx + 1].current?.focus();
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      inputRefs[idx - 1].current?.focus();
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (text.length === 4) {
      setPin(text.split(''));
      inputRefs[3].current?.focus();
    }
    e.preventDefault();
  }

  async function handleComplete() {
    if (!isComplete) { setError('Please enter the 4-digit PIN'); return; }
    if (!navigator.geolocation) { setError('Geolocation is not supported'); return; }
    
    setSubmitting(true);
    setError('Verifying location...');
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await apiService.completeJob(booking._id, {
          workPerformed: workNote.trim() || 'Job completed successfully',
          extraCharges: 0,
          endOtp: fullPin,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        toast.success('Job marked as completed! 🎉');
        onCompleted();
        onClose();
      } catch (err) {
        const msg = err.response?.data?.error || 'Failed to complete job';
        setError(msg);
        if (msg.toLowerCase().includes('pin')) {
          setPin(['', '', '', '']);
          inputRefs[0].current?.focus();
        }
      } finally {
        setSubmitting(false);
      }
    }, (err) => {
      setError('Location access required to complete job.');
      setSubmitting(false);
    }, { timeout: 10000 });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 max-w-lg mx-auto"
        style={{ animation: 'slideUp 0.25s ease-out' }}>

        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">🔐</div>
            <div>
              <h2 className="font-bold text-slate-900">Enter Completion PIN</h2>
              <p className="text-xs text-slate-500">{booking.serviceId?.name} · {booking.serviceAddress?.city}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Instruction */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6 text-center">
          <p className="text-sm font-semibold text-indigo-800">Ask the customer for their 4-digit PIN</p>
          <p className="text-xs text-indigo-500 mt-1">The customer sees this PIN in their app when the job started</p>
        </div>

        {/* PIN boxes */}
        <div className="flex justify-center gap-3 mb-4">
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="number"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`w-16 h-18 text-center text-3xl font-bold rounded-2xl border-2 outline-none transition-all
                ${error ? 'border-red-400 bg-red-50 text-red-600' : digit ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-800'}
                focus:border-indigo-500 focus:bg-indigo-50`}
              style={{ height: '4.5rem', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4 text-sm text-red-600">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Work note */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Work summary <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={workNote}
            onChange={e => setWorkNote(e.target.value)}
            rows={2}
            placeholder="e.g. Cleaned filters, checked wiring…"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-slate-50"
          />
        </div>

        {/* Confirm button */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl py-3.5 hover:bg-slate-50 text-sm">
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={submitting || !isComplete}
            className={`flex-1 font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 transition-all ${
              submitting || !isComplete
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
            }`}
          >
            {submitting ? 'Verifying…' : <><CheckCircle2 size={16} /> Confirm Job Done</>}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER BOOKINGS PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ProviderBookings() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || 'active';

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialTab);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [requestTimer, setRequestTimer] = useState(0);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [trackingTarget, setTrackingTarget] = useState(null);
  // paymentStatuses: { [bookingId]: { isPaid, paymentMethod, loading, confirming } }
  const [paymentStatuses, setPaymentStatuses] = useState({});

  useEffect(() => {
    loadBookings();
  }, [filter]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('booking:new_request', (data) => {
      setPendingRequest(data);
      setRequestTimer(data.acceptTimeoutSeconds || 120);
    });
    socket.on('booking:expired', () => {
      setPendingRequest(null);
      setRequestTimer(0);
    });
    // Real-time payment notification — customer paid online
    socket.on('payment:received', ({ bookingId, paymentMethod }) => {
      setPaymentStatuses(prev => ({
        ...prev,
        [bookingId]: { isPaid: true, paymentMethod: paymentMethod || 'online', loading: false, confirming: false },
      }));
      toast.success('💰 Payment received from customer!');
    });

    return () => {
      socket.off('booking:new_request');
      socket.off('booking:expired');
      socket.off('payment:received');
    };
  }, []);

  // Countdown for pending request
  useEffect(() => {
    if (!pendingRequest || requestTimer <= 0) return;
    const t = setInterval(() => {
      setRequestTimer(s => {
        if (s <= 1) { setPendingRequest(null); clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [pendingRequest]);

  async function loadBookings() {
    setLoading(true);
    try {
      const statuses = filter === 'pending'
        ? ['assigned']
        : filter === 'active'
          ? ['accepted', 'in_progress', 'completed']
          : filter === 'upcoming'
            ? ['accepted']
            : ['completed', 'paid', 'cancelled'];
      const res = await apiService.getMyBookings({ status: statuses.join(',') });
      const data = res.data.data;
      setBookings(data);
      // Fetch payment status for all completed (unpaid) bookings
      const completedUnpaid = data.filter(b => b.status === 'completed');
      if (completedUnpaid.length > 0) {
        const statusMap = {};
        await Promise.all(completedUnpaid.map(async (b) => {
          try {
            const r = await apiService.getPaymentStatus(b._id);
            statusMap[b._id] = { isPaid: r.data.data.isPaid, paymentMethod: r.data.data.paymentMethod, loading: false, confirming: false };
          } catch { statusMap[b._id] = { isPaid: false, paymentMethod: null, loading: false, confirming: false }; }
        }));
        setPaymentStatuses(prev => ({ ...prev, ...statusMap }));
      }
    } finally { setLoading(false); }
  }

  async function handleCashConfirm(bookingId) {
    setPaymentStatuses(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], confirming: true } }));
    try {
      await apiService.confirmCashPayment(bookingId);
      toast.success('✅ Cash payment confirmed!');
      setPaymentStatuses(prev => ({ ...prev, [bookingId]: { isPaid: true, paymentMethod: 'cash', loading: false, confirming: false } }));
      loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm cash');
      setPaymentStatuses(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], confirming: false } }));
    }
  }

  async function handleAccept(bookingId) {
    try {
      await apiService.acceptBooking(bookingId);
      toast.success('Booking accepted!');
      setPendingRequest(null);
      setFilter('active'); // Auto-switch to active jobs so they can Start the job
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  }

  async function handleReject(bookingId) {
    try {
      await apiService.rejectBooking(bookingId, 'Cannot take at this time');
      toast('Booking rejected');
      setPendingRequest(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  }

  async function handleStartJob(bookingId) {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    toast('Verifying location...', { icon: '📍' });
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await apiService.startJob(bookingId, { 
          otp: '0000', 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude 
        });
        toast.success('Job started!');
        loadBookings();
      } catch (e) { toast.error(e.response?.data?.error || 'Failed to start job'); }
    }, (err) => {
      toast.error('Location access required to start job.');
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-5">My Jobs</h1>

        {/* Pending booking request notification */}
        {pendingRequest && (
          <div className="card p-5 mb-5 border-2 border-primary-400 bg-primary-50">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔔</span>
                  <h3 className="font-bold text-slate-900">New Booking Request!</h3>
                </div>
                <p className="text-sm text-slate-600">{pendingRequest.service?.name || 'Service'}</p>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${requestTimer < 30 ? 'text-red-600' : 'text-primary-700'}`}>
                  {requestTimer}s
                </div>
                <p className="text-xs text-slate-400">remaining</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-xs text-slate-600">
              <div className="bg-white rounded-xl p-2.5 text-center">
                <MapPin size={14} className="mx-auto mb-1 text-primary-500" />
                <p className="font-medium">{pendingRequest.distanceKm || '?'} km away</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center">
                <Clock size={14} className="mx-auto mb-1 text-amber-500" />
                <p className="font-medium">{pendingRequest.timeSlot?.from || '?'}</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center">
                <DollarSign size={14} className="mx-auto mb-1 text-green-500" />
                <p className="font-medium">₹{pendingRequest.estimatedEarnings?.toFixed(0) || '?'}</p>
              </div>
            </div>

            {/* Timer bar */}
            <div className="h-1.5 bg-slate-200 rounded-full mb-4">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${requestTimer < 30 ? 'bg-red-500' : 'bg-primary-600'}`}
                style={{ width: `${(requestTimer / (pendingRequest.acceptTimeoutSeconds || 120)) * 100}%` }}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleReject(pendingRequest.bookingId)} className="flex-1 border-2 border-red-200 text-red-600 font-semibold rounded-xl py-3 hover:bg-red-50 flex items-center justify-center gap-2">
                <XCircle size={18} /> Decline
              </button>
              <button onClick={() => handleAccept(pendingRequest.bookingId)} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-base">
                <CheckCircle size={18} /> Accept Job
              </button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
          {[
            { id: 'pending',  label: '🔔 Requests' },
            { id: 'active',   label: 'Active' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'history',  label: 'History' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${filter === f.id ? 'bg-white shadow text-primary-700' : 'text-slate-500'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Booking list */}
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-5 skeleton h-28" />)}</div>
        ) : bookings.length === 0 ? (
          <EmptyState icon="📋" title={`No ${filter} jobs`} description={filter === 'pending' ? 'New booking requests will appear here' : 'New bookings will appear here'} />
        ) : (
          <div className="space-y-3">
            {bookings.map(b => (
              <div key={b._id} className={`card overflow-hidden transition-all ${b.status === 'in_progress' ? 'border-2 border-emerald-400' : ''}`}>
                {/* In-progress banner */}
                {b.status === 'in_progress' && (
                  <div className="bg-emerald-500 px-4 py-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-bold tracking-wide">JOB IN PROGRESS</span>
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded-xl text-2xl flex items-center justify-center shrink-0">
                      {b.serviceId?.icon || '🔧'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-800 text-sm">{b.serviceId?.name}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="text-xs text-slate-400 mt-1 space-y-1">
                        <div className="flex items-center gap-1"><Clock size={10} />{dayjs(b.scheduledDate).format('D MMM · h:mm A')}</div>
                        <div className="flex items-center gap-1"><MapPin size={10} />{b.serviceAddress?.city}</div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-green-600 text-sm">₹{b.providerEarnings?.toLocaleString('en-IN') || 0} earnings</span>
                        <div className="flex gap-2">
                          {/* Navigation & Map Buttons */}
                          {b.serviceAddress?.location?.coordinates && (
                            <>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  const [lng, lat] = b.serviceAddress.location.coordinates;
                                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                                }}
                                title="Navigate in Google Maps"
                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                              >
                                <Navigation size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setTrackingTarget(b);
                                }}
                                title="View on Live Map"
                                className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                              >
                                <Map size={16} />
                              </button>
                            </>
                          )}
                          
                          {b.status === 'assigned' && (
                            <>
                              <button onClick={() => handleReject(b._id)} className="border-2 border-red-200 text-red-600 font-semibold rounded-xl py-1.5 px-3 hover:bg-red-50 text-xs flex items-center gap-1">
                                <XCircle size={13} /> Decline
                              </button>
                              <button onClick={() => handleAccept(b._id)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                                <CheckCircle size={13} /> Accept
                              </button>
                            </>
                          )}
                          {b.status === 'accepted' && (
                            <button onClick={() => handleStartJob(b._id)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                                <Wrench size={13} /> Start Job
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ✅ COMPLETE JOB BUTTON */}
                  {b.status === 'in_progress' && (
                    <button
                      onClick={() => setCompleteTarget(b)}
                      className="w-full mt-4 flex items-center justify-center gap-2.5 text-white font-extrabold text-base py-4 rounded-2xl shadow-lg transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', boxShadow: '0 4px 20px rgba(5,150,105,0.4)' }}
                    >
                      <CheckCircle2 size={22} />
                      Mark Job as Completed
                    </button>
                  )}

                  {/* 💳 PAYMENT STATUS PANEL — shown after job is completed */}
                  {b.status === 'completed' && (() => {
                    const ps = paymentStatuses[b._id];
                    if (!ps) return (
                      <div className="mt-4 h-14 bg-slate-100 rounded-2xl animate-pulse" />
                    );
                    if (ps.isPaid) return (
                      <div className="mt-4 flex items-center gap-3 bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-4 py-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                          {ps.paymentMethod === 'cash' ? <Banknote size={20} className="text-emerald-600" /> : <CreditCard size={20} className="text-emerald-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-emerald-800 text-sm">Payment Received ✅</p>
                          <p className="text-xs text-emerald-600">{ps.paymentMethod === 'cash' ? 'Cash collected from customer' : 'Paid online via Razorpay'}</p>
                        </div>
                        <span className="text-emerald-700 font-bold text-sm">₹{b.totalAmount?.toLocaleString('en-IN')}</span>
                      </div>
                    );
                    return (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            <Hourglass size={18} className="text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-amber-800 text-sm">Payment Pending</p>
                            <p className="text-xs text-amber-600">Waiting for customer to pay ₹{b.totalAmount?.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCashConfirm(b._id)}
                          disabled={ps.confirming}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg,#d97706 0%,#f59e0b 100%)', boxShadow: '0 4px 16px rgba(217,119,6,0.35)' }}
                        >
                          {ps.confirming ? <><span className="animate-spin">↻</span> Confirming…</> : <><Banknote size={18} /> Customer Paid Cash — Confirm Receipt</>}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Job Modal */}
      {completeTarget && (
        <CompleteJobModal
          booking={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onCompleted={loadBookings}
        />
      )}

      {/* Customer Tracking Map Modal */}
      {trackingTarget && (
        <CustomerTrackingModal
          booking={trackingTarget}
          onClose={() => setTrackingTarget(null)}
        />
      )}
    </div>
  );
}
