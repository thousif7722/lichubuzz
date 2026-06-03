import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyBookings, selectBookings, selectBookingLoading } from '@/store/slices/bookingSlice';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { StatusBadge, EmptyState, CardSkeleton } from '@/components/common/UI';
import { Clock, ChevronRight, RotateCcw, Star, MapPin, MessageCircle } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'upcoming',  label: '📅 Upcoming',   statuses: 'pending,assigned,accepted' },
  { id: 'active',    label: '🔧 Active',      statuses: 'in_progress' },
  { id: 'completed', label: '✅ Completed',   statuses: 'completed,paid' },
  { id: 'cancelled', label: '❌ Cancelled',   statuses: 'cancelled' },
];

export default function MyBookings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const bookings = useSelector(selectBookings);
  const loading = useSelector(selectBookingLoading);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    const current = TABS.find(t => t.id === tab);
    dispatch(fetchMyBookings({ status: current.statuses }));
  }, [dispatch, tab]);

  function handleRebook(b) {
    navigate(`/book/${b.serviceId?._id}`, {
      state: {
        prefill: {
          city: b.serviceAddress?.city,
          state: b.serviceAddress?.state,
          pincode: b.serviceAddress?.pincode,
          line1: b.serviceAddress?.line1,
        }
      }
    });
    toast.success('Re-booking the same service!');
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6">

        <h1 className="text-2xl font-bold text-slate-900 mb-5">My Bookings</h1>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                tab === t.id
                  ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon="📋"
            title={`No ${tab} bookings`}
            description={tab === 'upcoming' ? 'Book a service to get started' : 'Nothing here yet'}
            action={<Link to="/" className="btn-primary">Browse Services</Link>}
          />
        ) : (
          <div className="space-y-3">
            {bookings.map(b => (
              <div key={b._id} className={`card overflow-hidden transition-all hover:shadow-elevated ${b.status === 'in_progress' ? 'border-2 border-primary-200' : ''}`}>

                {/* In-progress banner */}
                {b.status === 'in_progress' && (
                  <div className="bg-primary-600 text-white text-xs font-bold px-4 py-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Service in progress — provider is working
                  </div>
                )}

                <Link to={`/bookings/${b._id}`} className="block p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-50 to-indigo-50 rounded-2xl text-2xl flex items-center justify-center shrink-0">
                      {b.serviceId?.icon || '🔧'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-800 truncate">{b.serviceId?.name}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1.5">
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          <span>{dayjs(b.scheduledDate).format('ddd, D MMM · h:mm A')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={11} />
                          <span>{b.serviceAddress?.city}</span>
                        </div>
                      </div>

                      {/* Provider info if assigned */}
                      {b.providerId?.name && (
                        <div className="flex items-center gap-2 mt-2 bg-slate-50 rounded-xl px-2.5 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                            {b.providerId.name[0]}
                          </div>
                          <span className="text-xs font-medium text-slate-700">{b.providerId.name}</span>
                          {b.providerId.rating && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-600 ml-auto">
                              <Star size={10} className="fill-amber-400 text-amber-400" />
                              {b.providerId.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2.5">
                        <p className="text-base font-extrabold text-primary-700">₹{b.totalAmount?.toLocaleString('en-IN') || b.basePrice?.toLocaleString('en-IN')}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          #{b.bookingNumber}
                          <ChevronRight size={13} className="text-slate-300" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Action row for completed jobs */}
                {['completed', 'paid'].includes(b.status) && (
                  <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-2">
                    <button
                      onClick={() => handleRebook(b)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <RotateCcw size={12} /> Re-book
                    </button>
                    {b.status === 'paid' && !b.isRated && (
                      <Link
                        to={`/bookings/${b._id}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <Star size={12} className="fill-amber-400" /> Rate & Review
                      </Link>
                    )}
                    {b.status === 'paid' && (
                      <Link
                        to={`/bookings/${b._id}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all ml-auto"
                      >
                        Receipt →
                      </Link>
                    )}
                    {b.status === 'completed' && (
                      <Link
                        to={`/bookings/${b._id}/pay`}
                        className="ml-auto bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all"
                      >
                        Pay Now →
                      </Link>
                    )}
                  </div>
                )}

                {/* Active booking CTA */}
                {['pending', 'assigned', 'accepted'].includes(b.status) && (
                  <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {b.status === 'pending' ? '🕐 Finding provider…' : b.status === 'assigned' ? '📲 Waiting for confirmation' : '✅ Confirmed'}
                    </p>
                    <Link to={`/bookings/${b._id}`} className="text-xs font-semibold text-primary-600">
                      View details →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
