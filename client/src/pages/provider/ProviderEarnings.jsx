// ProviderEarnings.jsx
import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Wallet, TrendingUp, ArrowDownCircle, Loader, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function ProviderEarnings() {
  const [earnings, setEarnings] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    apiService.getEarnings(period).then(r => setEarnings(r.data.data));
  }, [period]);

  async function handleWithdraw() {
    const amount = Number(withdrawAmount);
    if (!amount || amount < 100) return toast.error('Minimum withdrawal is ₹100');
    setWithdrawing(true);
    try {
      await apiService.withdraw(amount);
      toast.success(`₹${amount} withdrawal initiated!`);
      setWithdrawAmount('');
      apiService.getEarnings(period).then(r => setEarnings(r.data.data));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setWithdrawing(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Earnings</h1>

        {/* Commission Dues Warning Banner */}
        {earnings?.summary?.pendingCommission > 0 && (
          <div className={`rounded-2xl border-2 p-4 ${earnings.summary.isOnHold ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${earnings.summary.isOnHold ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle size={20} className={earnings.summary.isOnHold ? 'text-red-600' : 'text-amber-600'} />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${earnings.summary.isOnHold ? 'text-red-800' : 'text-amber-800'}`}>
                  {earnings.summary.isOnHold ? '🔴 Account On Hold — No New Jobs' : '⚠️ Platform Commission Due'}
                </p>
                <p className={`text-xs mt-1 ${earnings.summary.isOnHold ? 'text-red-600' : 'text-amber-600'}`}>
                  You owe <strong>₹{earnings.summary.pendingCommission?.toLocaleString('en-IN')}</strong> in platform commission from cash jobs.
                  {earnings.summary.isOnHold
                    ? ' Your account is on hold. Contact admin to clear dues and resume accepting jobs.'
                    : ' Please pay within 3 days to avoid account hold.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Commission Cleared Success */}
        {earnings?.summary?.pendingCommission === 0 && earnings?.summary?.totalCommissionPaid > 0 && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">All platform commissions paid ✅</p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Wallet Balance', value: `₹${earnings?.summary?.walletBalance?.toLocaleString('en-IN') || 0}`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total Earned', value: `₹${earnings?.summary?.totalEarnings?.toLocaleString('en-IN') || 0}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`card p-5 ${bg} border-0`}>
              <Icon className={`${color} mb-3`} size={22} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Withdraw */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <ArrowDownCircle size={18} className="text-primary-600" /> Withdraw Earnings
          </h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount (min. ₹100)"
              className="input-field flex-1"
              min={100}
            />
            <button onClick={handleWithdraw} disabled={withdrawing} className="btn-primary px-5 flex items-center gap-1">
              {withdrawing ? <Loader size={15} className="animate-spin" /> : 'Withdraw'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Transfers in 2–3 business days to your linked bank account</p>
        </div>

        {/* Period selector + chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Earnings Chart</h3>
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {['7d', '30d', '90d'].map(p => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${period === p ? 'bg-white shadow text-primary-700' : 'text-slate-500'}`}>{p}</button>
              ))}
            </div>
          </div>
          {earnings?.weeklyEarnings?.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={earnings.weeklyEarnings}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="_id" tickFormatter={d => dayjs(d).format('DD')} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Earnings']} />
                <Area type="monotone" dataKey="amount" stroke="#2563EB" fill="#DBEAFE" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No earnings data for this period</div>
          )}
        </div>

        {/* Job breakdown */}
        {earnings?.jobBreakdown?.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Earnings by Service</h3>
            <div className="space-y-3">
              {earnings.jobBreakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{item.service?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{item.count} jobs</p>
                  </div>
                  <span className="font-bold text-emerald-600">₹{item.earnings?.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
