import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { StatusBadge } from '@/components/common/UI';
import {
  Search, X, UserCheck, RefreshCw, ChevronLeft, ChevronRight,
  Phone, Star, MapPin, Clock, Calendar, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const STATUSES = ['', 'pending', 'assigned', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'];

// ── Assign Provider Modal ──────────────────────────────────────────────────────
function AssignModal({ booking, onClose, onAssigned }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    apiService.getAdminProviders({ approvalStatus: 'approved', limit: 100 })
      .then(res => setProviders(res.data.data || []))
      .catch(() => toast.error('Failed to load providers'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = providers.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.phone?.includes(q);
  });

  async function assign(provider) {
    setAssigning(provider._id);
    try {
      await apiService.assignBooking(booking._id, provider._id);
      toast.success(`✅ Assigned to ${provider.name}`);
      onAssigned();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed');
    }
    setAssigning(null);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assign Provider</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Booking <span className="font-mono font-semibold text-slate-700">#{booking.bookingNumber}</span>
              {' · '}{booking.serviceId?.name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Booking summary */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1"><Calendar size={11} /> {dayjs(booking.scheduledDate).format('D MMM YYYY')}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {booking.timeSlot?.from}–{booking.timeSlot?.to}</span>
            <span className="flex items-center gap-1"><MapPin size={11} /> {booking.serviceAddress?.city}</span>
          </div>
          {booking.providerId && (
            <p className="mt-1 text-xs text-amber-600 font-medium">
              ⚠️ Currently assigned to: {booking.providerId.name} — reassigning will override
            </p>
          )}
        </div>

        {/* Search */}
        <div className="px-6 py-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search providers by name or phone…"
              className="flex-1 bg-transparent text-sm outline-none text-slate-800 placeholder:text-slate-400"
            />
            {search && <button onClick={() => setSearch('')}><X size={13} className="text-slate-400" /></button>}
          </div>
        </div>

        {/* Provider list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No providers found</p>
            </div>
          ) : (
            filtered.map(provider => (
              <div
                key={provider._id}
                className="flex items-center justify-between bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl px-4 py-3 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 text-sm shrink-0">
                    {provider.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{provider.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <Star size={10} fill="currentColor" /> {provider.rating?.toFixed(1) || '—'}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-0.5">
                        <Phone size={10} /> {provider.phone}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${provider.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        {provider.isOnline ? '● Online' : '○ Offline'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => assign(provider)}
                  disabled={assigning === provider._id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all disabled:opacity-60 shrink-0"
                >
                  {assigning === provider._id ? (
                    <span className="animate-spin">↻</span>
                  ) : (
                    <><UserCheck size={13} /> Assign</>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main AdminBookings Page ────────────────────────────────────────────────────
export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [assignTarget, setAssignTarget] = useState(null); // booking to assign

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminBookings({
        page, limit: 15,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setBookings(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch { toast.error('Failed to load bookings'); }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side search on top of server-side data
  const filtered = bookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.bookingNumber?.toLowerCase().includes(q) ||
      b.customerId?.name?.toLowerCase().includes(q) ||
      b.customerId?.phone?.includes(q) ||
      b.serviceId?.name?.toLowerCase().includes(q) ||
      b.providerId?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
            <p className="text-slate-500 text-sm mt-0.5">{pagination.total || 0} total · Assign providers to pending bookings</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition shadow-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 shadow-sm">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by booking #, customer, service, provider…"
              className="flex-1 outline-none text-sm text-slate-800 bg-transparent placeholder:text-slate-400"
            />
            {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="outline-none text-sm text-slate-700 bg-transparent cursor-pointer"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s ? s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase()) : 'All Statuses'}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse bg-slate-50 mx-4 my-2 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-slate-500 font-medium">No bookings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Booking</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Service</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Scheduled</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Provider</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(b => (
                    <tr key={b._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs font-bold text-primary-700">#{b.bookingNumber}</p>
                        <p className="text-xs text-slate-400 mt-0.5">₹{b.totalAmount?.toLocaleString('en-IN') || b.basePrice}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-slate-800">{b.customerId?.name || '—'}</p>
                        <p className="text-xs text-slate-400">{b.customerId?.phone}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-slate-700">{b.serviceId?.name || '—'}</p>
                        <p className="text-xs text-slate-400">{b.serviceId?.category}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-slate-700">{dayjs(b.scheduledDate).format('D MMM')}</p>
                        <p className="text-xs text-slate-400">{b.timeSlot?.from}–{b.timeSlot?.to}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        {b.providerId ? (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">{b.providerId.name}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Star size={9} fill="currentColor" className="text-amber-400" />
                              {b.providerId.rating?.toFixed(1)} · {b.providerId.phone}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {!['completed', 'paid', 'cancelled'].includes(b.status) && (
                          <button
                            onClick={() => setAssignTarget(b)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ml-auto
                              bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md"
                          >
                            <UserCheck size={13} />
                            {b.providerId ? 'Reassign' : 'Assign'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-5">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total} bookings)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignModal
          booking={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={load}
        />
      )}
    </div>
  );
}
