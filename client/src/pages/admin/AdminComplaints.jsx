import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Search, AlertTriangle, ShieldAlert, CheckCircle, Clock, RefreshCw, User, Users } from 'lucide-react';
import { StatusBadge, ConfirmModal } from '@/components/common/UI';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(null); // { type: 'reassign', complaint }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminComplaints({ page, limit: 20, status: statusFilter || undefined });
      setComplaints(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleReassign(complaint) {
    try {
      await apiService.reassignComplaint(complaint._id, 'reassign_provider');
      toast.success('Booking sent for automatic reassignment');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reassignment failed');
    }
    setModal(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="text-red-600" /> Customer Complaints <span className="text-slate-400 font-normal text-lg ml-2">({total})</span>
            </h1>
            <p className="text-sm text-slate-500">Manage disputes and reassign problematic bookings.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-3 flex-wrap bg-slate-50">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-40 bg-white">
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
            </select>
            <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm py-2"><RefreshCw size={14} /> Refresh</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Booking Info</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">Loading complaints...</td></tr>
                ) : complaints.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">No complaints found.</td></tr>
                ) : complaints.map(c => (
                  <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-medium text-slate-800">{c.ticketNumber}</div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Clock size={10} /> {dayjs(c.createdAt).format('MMM D, HH:mm')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${c.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.category.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {c.bookingId ? (
                        <>
                          <div className="text-slate-800 font-medium">#{c.bookingId.bookingNumber}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{dayjs(c.bookingId.scheduledDate).format('MMM D, YYYY')}</div>
                        </>
                      ) : <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="px-6 py-4">
                      {c.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-purple-500" />
                          <span className="font-semibold text-purple-700 bg-purple-50 px-2 rounded">{c.assignedTo.name}</span>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.status === 'open' ? 'bg-blue-100 text-blue-700' : c.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {c.status !== 'resolved' && (
                          <button onClick={() => setModal({ type: 'reassign', complaint: c })} className="text-primary-600 font-medium hover:text-primary-800 flex items-center gap-1 text-sm border-2 border-primary-100 bg-primary-50 px-3 py-1.5 rounded-lg hover:border-primary-200">
                            <RefreshCw size={14} /> Reassign Booking
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-slate-500">Showing {complaints.length} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <span className="px-3 py-1.5 text-sm text-slate-600">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={complaints.length < 20} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>

      </div>

      <ConfirmModal
        isOpen={modal?.type === 'reassign'}
        title="Reassign Booking?"
        message={`Are you sure you want to remove the current provider and automatically reassign booking #${modal?.complaint?.bookingId?.bookingNumber} to a new technician?`}
        confirmLabel="Reassign Booking"
        variant="primary"
        onConfirm={() => handleReassign(modal.complaint)}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
