import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { StatusBadge, ConfirmModal, EmptyState } from '@/components/common/UI';
import { Search, Ban, CheckCircle, AlertTriangle, RefreshCw, Download, Eye, FileText, CreditCard, X } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

// ── Shared table styles ────────────────────────────────────────────────────────
const thCls = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider';
const tdCls = 'px-4 py-3 text-sm text-slate-700';

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN USERS PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(null); // { type, user }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminUsers({ page, limit: 20, search: search || undefined });
      setUsers(res.data.data);
      setTotal(res.data.pagination.total);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function handleBlock(user) {
    try {
      await apiService.blockUser(user._id, 'Admin action');
      toast.success(`${user.name} blocked`);
      load();
    } catch { toast.error('Action failed'); }
    setModal(null);
  }

  async function handleUnblock(user) {
    try {
      await apiService.unblockUser(user._id);
      toast.success(`${user.name} unblocked`);
      load();
    } catch { toast.error('Action failed'); }
    setModal(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header />
      <div className="pt-16 page-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Users <span className="text-slate-400 font-normal text-base ml-2">({total})</span></h1>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm"><RefreshCw size={14} /> Refresh</button>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or phone…" className="input-field pl-9 py-2 text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Name', 'Phone', 'Bookings', 'Total Spent', 'Joined', 'Status', 'Actions'].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className={tdCls}><div className="skeleton h-4 rounded w-24" /></td>)}</tr>
                  ))
                ) : users.map(user => (
                  <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                          {user.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user.name || 'No name'}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tdCls + ' font-mono'}>{user.phone}</td>
                    <td className={tdCls}>{user.totalBookings || 0}</td>
                    <td className={tdCls}>₹{user.totalSpent?.toLocaleString('en-IN') || 0}</td>
                    <td className={tdCls + ' text-slate-400'}>{dayjs(user.createdAt).format('D MMM YY')}</td>
                    <td className={tdCls}>
                      <span className={`status-badge ${user.isBlocked ? 'status-cancelled' : 'bg-green-100 text-green-700'}`}>
                        {user.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className={tdCls}>
                      {user.isBlocked ? (
                        <button onClick={() => setModal({ type: 'unblock', user })} className="text-green-600 hover:underline text-xs font-medium flex items-center gap-1">
                          <CheckCircle size={13} /> Unblock
                        </button>
                      ) : (
                        <button onClick={() => setModal({ type: 'block', user })} className="text-red-500 hover:underline text-xs font-medium flex items-center gap-1">
                          <Ban size={13} /> Block
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Showing {users.length} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <span className="px-3 py-1.5 text-sm text-slate-600">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!modal}
        title={modal?.type === 'block' ? 'Block User?' : 'Unblock User?'}
        message={modal?.type === 'block' ? `Block ${modal?.user?.name}? They won't be able to login.` : `Restore ${modal?.user?.name}'s access.`}
        confirmLabel={modal?.type === 'block' ? 'Block User' : 'Unblock'}
        variant={modal?.type === 'block' ? 'danger' : 'primary'}
        onConfirm={() => modal?.type === 'block' ? handleBlock(modal.user) : handleUnblock(modal.user)}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PROVIDERS PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function AdminProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(null);
  const [detailsProvider, setDetailsProvider] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminProviders({ page, limit: 20, search: search || undefined, approvalStatus: statusFilter || undefined });
      setProviders(res.data.data);
      setTotal(res.data.pagination.total);
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(provider) {
    try {
      await apiService.approveProvider(provider._id);
      toast.success(`${provider.name} approved!`);
      load();
    } catch { toast.error('Failed'); }
    setModal(null);
  }

  async function handleReject(provider) {
    try {
      await apiService.rejectProvider(provider._id, 'Does not meet requirements');
      toast.success('Provider rejected');
      load();
    } catch { toast.error('Failed'); }
    setModal(null);
  }

  async function handleWarn(provider) {
    try {
      await apiService.warnProvider(provider._id, 'Admin warning issued');
      toast.success(`Warning issued to ${provider.name}`);
      load();
    } catch { toast.error('Failed'); }
    setModal(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header />
      <div className="pt-16 page-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Providers <span className="text-slate-400 font-normal text-base ml-2">({total})</span></h1>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search providers…" className="input-field pl-9 py-2 text-sm" />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-auto">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <button onClick={load} className="btn-secondary flex items-center gap-1 text-sm py-2"><RefreshCw size={14} /></button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Provider', 'Phone', 'Services', 'Rating', 'Jobs', 'KYC', 'Assigned To', 'Status', 'Actions'].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} className={tdCls}><div className="skeleton h-4 rounded w-20" /></td>)}</tr>
                  ))
                ) : providers.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className={tdCls}>
                      <div>
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.city}, {p.state}</p>
                      </div>
                    </td>
                    <td className={tdCls + ' font-mono'}>{p.phone}</td>
                    <td className={tdCls}><span className="text-xs">{p.services?.map(s => s.name).join(', ').slice(0, 40) || '—'}</span></td>
                    <td className={tdCls}>{p.rating?.toFixed(1) || '—'} ⭐</td>
                    <td className={tdCls}>{p.completedJobs || 0}</td>
                    <td className={tdCls}>
                      <span className={`status-badge text-xs ${p.kyc?.status === 'verified' ? 'bg-green-100 text-green-700' : p.kyc?.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.kyc?.status || 'Pending'}
                      </span>
                    </td>
                    <td className={tdCls}>
                      {p.approvalStatus === 'pending' && p.kyc?.assignedTo ? (
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold whitespace-nowrap">
                          Assigned
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <span className={`status-badge text-xs ${p.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : p.approvalStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {p.approvalStatus}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setDetailsProvider(p)} className="text-primary-600 text-xs font-medium hover:underline flex items-center gap-1">
                          <Eye size={13} /> View KYC
                        </button>
                        {p.approvalStatus === 'pending' && (
                          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                            <button onClick={() => handleApprove(p)} className="text-green-600 text-xs font-medium hover:underline">Approve</button>
                            <button onClick={() => handleReject(p)} className="text-red-500 text-xs font-medium hover:underline">Reject</button>
                          </div>
                        )}
                        {p.approvalStatus === 'approved' && (
                          <button onClick={() => setModal({ type: 'warn', provider: p })} className="text-amber-600 text-xs font-medium hover:underline flex items-center gap-1 pl-3 border-l border-slate-200">
                            <AlertTriangle size={11} /> Warn
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">{providers.length} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={providers.length < 20} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={modal?.type === 'warn'}
        title="Issue Warning?"
        message={`Issue a warning to ${modal?.provider?.name}? After 3 warnings, they will be auto-blocked.`}
        confirmLabel="Issue Warning"
        variant="danger"
        onConfirm={() => handleWarn(modal.provider)}
        onCancel={() => setModal(null)}
      />

      {detailsProvider && (
        <KYCDetailsModal 
          provider={detailsProvider} 
          onClose={() => setDetailsProvider(null)} 
          onApprove={() => { handleApprove(detailsProvider); setDetailsProvider(null); }}
          onReject={() => { handleReject(detailsProvider); setDetailsProvider(null); }}
        />
      )}
    </div>
  );
}

function KYCDetailsModal({ provider, onClose, onApprove, onReject }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 font-bold text-lg">
              {provider.name?.[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 leading-none">{provider.name}</h2>
              <p className="text-xs text-slate-500 mt-1">{provider.phone} • {provider.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto bg-slate-50 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* KYC Section */}
            <div className="card p-5 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText size={16} className="text-primary-600" /> Identity Documents (KYC)
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">KYC Status</p>
                  <span className={`status-badge text-xs ${provider.kyc?.status === 'verified' ? 'bg-green-100 text-green-700' : provider.kyc?.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {provider.kyc?.status || 'Pending'}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">Aadhaar Number</p>
                  <p className="font-medium text-slate-800">{provider.kyc?.aadhaarNumber || 'Not provided'}</p>
                  {provider.kyc?.aadhaarDoc && (
                    <a href={provider.kyc.aadhaarDoc} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline mt-1 inline-block">View Aadhaar Document ↗</a>
                  )}
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">PAN Number</p>
                  <p className="font-medium text-slate-800">{provider.kyc?.panNumber || 'Not provided'}</p>
                  {provider.kyc?.panDoc && (
                    <a href={provider.kyc.panDoc} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline mt-1 inline-block">View PAN Document ↗</a>
                  )}
                </div>

                {provider.kyc?.selfie && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Selfie Photo</p>
                    <img src={provider.kyc.selfie} alt="Selfie" className="w-24 h-24 object-cover rounded-xl border border-slate-200" />
                  </div>
                )}
              </div>
            </div>

            {/* Bank Section */}
            <div className="card p-5 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-emerald-600" /> Bank & Payouts
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Account Holder Name</p>
                  <p className="font-medium text-slate-800">{provider.earnings?.bankAccount?.accountHolder || 'Not provided'}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">Account Number</p>
                  <p className="font-medium text-slate-800 font-mono tracking-wider">{provider.earnings?.bankAccount?.accountNumber || 'Not provided'}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">IFSC Code</p>
                  <p className="font-medium text-slate-800 font-mono">{provider.earnings?.bankAccount?.ifscCode || 'Not provided'}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">Bank Name</p>
                  <p className="font-medium text-slate-800">{provider.earnings?.bankAccount?.bankName || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary px-5">Close</button>
          {provider.approvalStatus === 'pending' && (
            <>
              <button onClick={onReject} className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 px-5 text-sm">Reject Request</button>
              <button onClick={onApprove} className="btn-primary px-8 text-sm">Approve Provider</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN BOOKINGS (simplified)
// ══════════════════════════════════════════════════════════════════════════════
export function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminBookings({ page, limit: 25, status: statusFilter || undefined });
      setBookings(res.data.data);
      setTotal(res.data.pagination.total);
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header />
      <div className="pt-16 page-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Bookings <span className="text-slate-400 font-normal text-base ml-2">({total})</span></h1>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-3">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-auto">
              <option value="">All Statuses</option>
              {['pending','assigned','accepted','in_progress','completed','paid','cancelled','disputed'].map(s => (
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              ))}
            </select>
            <button onClick={load} className="btn-secondary flex items-center gap-1 text-sm py-2"><RefreshCw size={14} /></button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Booking #', 'Service', 'Customer', 'Provider', 'Date', 'Amount', 'Status'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(10)].map((_, i) => <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className={tdCls}><div className="skeleton h-4 rounded w-20" /></td>)}</tr>)
                ) : bookings.map(b => (
                  <tr key={b._id} className="hover:bg-slate-50">
                    <td className={tdCls + ' font-mono text-xs'}>{b.bookingNumber}</td>
                    <td className={tdCls}>{b.serviceId?.name}</td>
                    <td className={tdCls}>{b.customerId?.name}<br /><span className="text-xs text-slate-400">{b.customerId?.phone}</span></td>
                    <td className={tdCls}>{b.providerId?.name || <span className="text-slate-400">—</span>}</td>
                    <td className={tdCls + ' text-slate-400 text-xs'}>{dayjs(b.scheduledDate).format('D MMM YY')}</td>
                    <td className={tdCls + ' font-semibold'}>₹{b.totalAmount?.toLocaleString('en-IN')}</td>
                    <td className={tdCls}><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-between items-center">
            <p className="text-sm text-slate-500">{bookings.length} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => p+1)} disabled={bookings.length<25} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN FINANCIALS (simplified)
// ══════════════════════════════════════════════════════════════════════════════
export function AdminFinancials() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiService.getFinancials({ from, to });
      setData(res.data.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header />
      <div className="pt-16 page-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Financials</h1>
          <div className="flex items-center gap-3">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field py-2 text-sm w-auto" />
            <span className="text-slate-400">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field py-2 text-sm w-auto" />
            <button onClick={load} disabled={loading} className="btn-primary py-2 text-sm flex items-center gap-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Apply</button>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Gross Revenue', value: `₹${data.revenue.amount.toLocaleString('en-IN')}`, sub: `${data.revenue.transactions} transactions`, cls: 'text-blue-600 bg-blue-50' },
              { label: 'Platform Commission', value: `₹${data.commissions.amount.toLocaleString('en-IN')}`, sub: `${data.commissions.transactions} entries`, cls: 'text-emerald-600 bg-emerald-50' },
              { label: 'Refunds', value: `₹${data.refunds.amount.toLocaleString('en-IN')}`, sub: `${data.refunds.transactions} refunds`, cls: 'text-red-600 bg-red-50' },
              { label: 'Net Revenue', value: `₹${data.netRevenue.toLocaleString('en-IN')}`, sub: 'After refunds', cls: 'text-purple-600 bg-purple-50' },
            ].map(({ label, value, sub, cls }) => (
              <div key={label} className={`card p-5 border-0 ${cls.split(' ')[1]}`}>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{label}</p>
                <p className={`text-2xl font-bold ${cls.split(' ')[0]}`}>{value}</p>
                <p className="text-xs text-slate-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUsers;
