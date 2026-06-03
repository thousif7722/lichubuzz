import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBookingById, selectCurrentBooking, selectBookingLoading } from '@/store/slices/bookingSlice';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { StatusBadge, StarRating, ConfirmModal, PageLayout } from '@/components/common/UI';
import { MapPin, Clock, Phone, Star, AlertCircle, Download, MessageCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function BookingDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const booking = useSelector(selectCurrentBooking);
  const loading = useSelector(selectBookingLoading);
  const [cancelModal, setCancelModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);

  useEffect(() => {
    dispatch(fetchBookingById(id));
    const interval = setInterval(() => {
      // Poll while job is active (includes in_progress so endOtp is always fresh)
      if (['pending','assigned','accepted','in_progress'].includes(booking?.status)) {
        dispatch(fetchBookingById(id));
      }
    }, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [id, dispatch, booking?.status]);

  async function handleCancel() {
    try {
      await apiService.cancelBooking(id, 'Customer requested cancellation');
      toast.success('Booking cancelled');
      dispatch(fetchBookingById(id));
      setCancelModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  }

  async function handleDownloadInvoice() {
    try {
      const response = await apiService.downloadInvoice(id);
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${booking.bookingNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Invoice not available'); }
  }

  if (loading && !booking) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) return (
    <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center text-slate-400">
      Booking not found
    </div>
  );

  const canCancel = ['pending','assigned','accepted'].includes(booking.status);
  const canPay = booking.status === 'completed';
  const canReview = booking.status === 'paid' && !booking.isRated;
  const canTrack = ['accepted','in_progress'].includes(booking.status);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Booking Details</h1>
            <p className="text-slate-400 text-sm mt-0.5">#{booking.bookingNumber}</p>
          </div>
          <StatusBadge status={booking.status} size="lg" />
        </div>

        {/* Status timeline */}
        <StatusTimeline booking={booking} />

        {/* Service info */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-50 rounded-xl text-3xl flex items-center justify-center">
              {booking.serviceId?.icon || '🔧'}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900">{booking.serviceId?.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                <Clock size={13} />
                <span>{dayjs(booking.scheduledDate).format('ddd, D MMM')} · {booking.timeSlot?.from}–{booking.timeSlot?.to}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-primary-600" /> Service Address
          </h3>
          <p className="text-slate-600 text-sm">
            {booking.serviceAddress?.line1}, {booking.serviceAddress?.city}, {booking.serviceAddress?.state} — {booking.serviceAddress?.pincode}
          </p>
        </div>

        {/* ── Completion PIN — visible only when job is in progress ── */}
        {booking.status === 'in_progress' && (
          <div className="card p-5 mb-4 border-2 border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔐</span>
                <div>
                  <h3 className="font-bold text-indigo-900">Your Completion PIN</h3>
                  <p className="text-xs text-indigo-600">Share this PIN with the provider when the job is done</p>
                </div>
              </div>
              <button
                onClick={() => dispatch(fetchBookingById(id))}
                className="text-xs text-indigo-500 underline font-medium"
              >
                Refresh
              </button>
            </div>
            {booking.endOtp ? (
              <>
                <div className="flex justify-center gap-3 my-4">
                  {booking.endOtp.split('').map((digit, i) => (
                    <div key={i} className="w-16 h-20 bg-white border-2 border-indigo-400 rounded-2xl flex items-center justify-center text-4xl font-extrabold text-indigo-700 shadow-lg">
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-indigo-500">
                  🔒 Only share when you're satisfied the work is complete
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-indigo-600">PIN loading... tap <strong>Refresh</strong> if it doesn't appear</p>
              </div>
            )}
          </div>
        )}

        {/* Provider info */}
        {booking.providerId && (
          <div className="card p-5 mb-4">
            <h3 className="font-semibold text-slate-800 mb-3">Service Provider</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 text-lg">
                  {booking.providerId.name?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{booking.providerId.name}</p>
                  <div className="flex items-center gap-1 text-amber-500 text-xs">
                    <Star size={11} fill="currentColor" />
                    <span>{booking.providerId.rating}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {canTrack && (
                  <Link to={`/bookings/${id}/track`} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1">
                    📍 Track
                  </Link>
                )}
                <a href={`tel:${booking.providerId.phone}`} className="btn-primary text-xs py-2 px-3 flex items-center gap-1">
                  <Phone size={13} /> Call
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Bill */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-slate-800 mb-3">Bill Summary</h3>
          <BillBreakdown booking={booking} />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {canPay && (
            <Link to={`/bookings/${id}/pay`} className="btn-primary w-full py-4 text-base text-center block">
              💳 Pay ₹{booking.totalAmount?.toLocaleString('en-IN')}
            </Link>
          )}
          {canReview && (
            <button onClick={() => setReviewModal(true)} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
              <Star size={16} /> Rate this service
            </button>
          )}
          {booking.status === 'paid' && (
            <button onClick={handleDownloadInvoice} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
              <Download size={16} /> Download Invoice (GST)
            </button>
          )}
          {canCancel && (
            <button onClick={() => setCancelModal(true)} className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors">
              Cancel Booking
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={cancelModal}
        title="Cancel Booking?"
        message="Cancellation charges may apply depending on how close to the scheduled time you cancel."
        confirmLabel="Yes, Cancel"
        onConfirm={handleCancel}
        onCancel={() => setCancelModal(false)}
      />

      {reviewModal && (
        <ReviewModal bookingId={id} onClose={() => setReviewModal(false)} onSuccess={() => { setReviewModal(false); dispatch(fetchBookingById(id)); }} />
      )}
    </div>
  );
}

function StatusTimeline({ booking }) {
  const STEPS = ['pending','assigned','accepted','in_progress','completed','paid'];
  const currentIndex = STEPS.indexOf(booking.status);
  if (booking.status === 'cancelled') {
    return (
      <div className="card p-4 mb-4 bg-red-50 border-red-100 flex items-center gap-3">
        <span className="text-2xl">❌</span>
        <div>
          <p className="font-semibold text-red-700">Booking Cancelled</p>
          <p className="text-xs text-red-500">{booking.cancellation?.reason}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card p-5 mb-4">
      <h3 className="font-semibold text-slate-800 mb-4">Booking Progress</h3>
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done = i <= currentIndex;
          const active = i === currentIndex;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-400'
                } ${active ? 'ring-4 ring-primary-200' : ''}`}>
                  {done ? '✓' : i + 1}
                </div>
                <p className={`text-[9px] mt-1 text-center capitalize leading-tight ${done ? 'text-primary-700 font-semibold' : 'text-slate-400'}`}>
                  {step.replace('_', '\n')}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-shrink-0 w-full max-w-[20px] transition-all ${i < currentIndex ? 'bg-primary-600' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function BillBreakdown({ booking }) {
  return (
    <div className="space-y-2 text-sm">
      {[
        { label: 'Base price', value: booking.basePrice },
        booking.surgeMultiplier > 1 && { label: `Surge (${booking.surgeMultiplier}x)`, value: booking.basePrice * (booking.surgeMultiplier - 1) },
        booking.materialCost > 0 && { label: 'Materials used', value: booking.materialCost },
        booking.extraCharges > 0 && { label: booking.extraChargesNote || 'Extra charges', value: booking.extraCharges },
        booking.discountAmount > 0 && { label: `Discount (${booking.couponCode})`, value: -booking.discountAmount, cls: 'text-green-600' },
      ].filter(Boolean).map(({ label, value, cls }) => (
        <div key={label} className={`flex justify-between ${cls || 'text-slate-600'}`}>
          <span>{label}</span>
          <span className={value < 0 ? 'text-green-600' : ''}>{value < 0 ? '-' : ''}₹{Math.abs(value).toLocaleString('en-IN')}</span>
        </div>
      ))}
      <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-100">
        <span>Total</span>
        <span className="text-primary-700">₹{booking.totalAmount?.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}

function ReviewModal({ bookingId, onClose, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!rating) return toast.error('Please select a rating');
    setSubmitting(true);
    try {
      await apiService.createReview({ bookingId, rating, comment });
      toast.success('Review submitted! Thank you.');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 animate-slide-up">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Rate your experience</h3>
        <p className="text-slate-500 text-sm mb-6">How was the service? Your feedback helps others.</p>
        <div className="flex justify-center mb-6">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Share your experience (optional)…"
          rows={3}
          className="input-field resize-none mb-4"
          maxLength={500}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">Skip</button>
          <button onClick={handleSubmit} disabled={submitting || !rating} className="flex-1 btn-primary">
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
