import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Skeleton } from '@/components/common/UI';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, Briefcase, DollarSign, Star, AlertTriangle,
  TrendingUp, Clock, Shield, BarChart2, RefreshCw,
} from 'lucide-react';
import dayjs from 'dayjs';

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await apiService.getDashboard();
      setData(res.data.data);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <Header />
      <div className="page-container grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  );

  const { overview, bookings, revenue, charts } = data || {};
  const pieData = Object.entries(bookings?.statusBreakdown || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header />
      <div className="pt-16 page-container">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Last updated {dayjs(lastRefresh).format('HH:mm:ss')}</p>
          </div>
          <button onClick={loadDashboard} disabled={loading} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Users', value: overview?.totalUsers?.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', link: '/admin/users' },
            { label: 'Providers', value: overview?.totalProviders?.toLocaleString(), icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50', link: '/admin/providers' },
            { label: 'Active Bookings', value: overview?.activeBookings?.toLocaleString(), icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50', link: '/admin/bookings' },
            { label: 'Online Providers', value: overview?.onlineProviders?.toLocaleString(), icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: "Today's Revenue", value: `₹${revenue?.today?.toLocaleString('en-IN')}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', link: '/admin/financials' },
            { label: 'Monthly Revenue', value: `₹${revenue?.monthly?.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/admin/financials' },
            { label: 'Pending KYC', value: overview?.pendingKYC?.toLocaleString(), icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', link: '/admin/providers?status=pending' },
            { label: 'Open Complaints', value: overview?.openComplaints?.toLocaleString(), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, icon: Icon, color, bg, link }) => {
            const card = (
              <div className={`card p-4 ${bg} border-0 ${link ? 'hover:shadow-elevated transition-shadow cursor-pointer' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <Icon className={color} size={20} />
                  {link && <span className="text-slate-300 text-xs">→</span>}
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
                <p className="text-slate-500 text-xs font-medium mt-0.5">{label}</p>
              </div>
            );
            return link ? <Link key={label} to={link}>{card}</Link> : <div key={label}>{card}</div>;
          })}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* Revenue chart */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Revenue (Last 7 Days)</h3>
              <Link to="/admin/financials" className="text-primary-600 text-xs font-medium hover:underline">View all</Link>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={charts?.revenueByDay || []} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="_id" tickFormatter={d => dayjs(d).format('DD MMM')} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} labelFormatter={d => dayjs(d).format('D MMM')} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="#DBEAFE" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Booking status pie */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Booking Status</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* Top providers + services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Top Providers</h3>
              <Link to="/admin/providers" className="text-primary-600 text-xs hover:underline">Manage</Link>
            </div>
            <div className="space-y-3">
              {(charts?.topProviders || []).slice(0, 5).map((p, i) => (
                <div key={p._id} className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm font-bold w-5">{i + 1}</span>
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">
                    {p.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.completedJobs} jobs · ₹{p.earnings?.totalEarnings?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500 text-xs">
                    <Star size={11} fill="currentColor" />
                    {p.rating?.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Top Services</h3>
              <span className="text-slate-400 text-xs">By bookings this month</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts?.topServices || []} layout="vertical" margin={{ left: -10, right: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Cancellation Rate', value: `${bookings?.cancellationRate || 0}%`, cls: 'text-red-600' },
            { label: 'Today Transactions', value: revenue?.todayTransactions, cls: 'text-slate-800' },
            { label: 'Monthly Transactions', value: revenue?.monthlyTransactions, cls: 'text-slate-800' },
            { label: 'Avg Order Value', value: revenue?.monthlyTransactions > 0 ? `₹${Math.round((revenue?.monthly || 0) / revenue.monthlyTransactions).toLocaleString('en-IN')}` : '—', cls: 'text-slate-800' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-xl font-bold ${cls}`}>{value ?? '—'}</p>
              <p className="text-slate-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
