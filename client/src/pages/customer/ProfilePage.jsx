import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser, logout, updateUser } from '@/store/slices/authSlice';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { User, Phone, Mail, Wallet, Star, Tag, LogOut, ChevronRight, Edit3, Check } from 'lucide-react';
import { apiService } from '@/services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  async function handleSaveName() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // In production, a PATCH /users/me endpoint would handle this
      dispatch(updateUser({ name: name.trim() }));
      localStorage.setItem('user', JSON.stringify({ ...user, name: name.trim() }));
      toast.success('Name updated');
      setEditName(false);
    } catch { toast.error('Failed to update'); }
    setSaving(false);
  }

  function handleLogout() {
    dispatch(logout());
    navigate('/login');
  }

  const menuItems = [
    { icon: Tag, label: 'My Coupons & Offers', action: () => toast('Coming soon') },
    { icon: Star, label: 'My Reviews', action: () => toast('Coming soon') },
    { icon: Wallet, label: 'Wallet & Payments', action: () => toast('Coming soon') },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Avatar + name */}
        <div className="card p-6 flex items-center gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-700 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            {editName ? (
              <div className="flex items-center gap-2">
                <input value={name} onChange={e => setName(e.target.value)} className="input-field py-2 text-sm flex-1" autoFocus />
                <button onClick={handleSaveName} disabled={saving} className="btn-primary py-2 px-3">
                  {saving ? '…' : <Check size={16} />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 truncate">{user?.name || 'Add your name'}</h2>
                <button onClick={() => setEditName(true)} className="text-slate-400 hover:text-primary-600">
                  <Edit3 size={15} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-sm">
              <Phone size={13} />
              <span>+91 {user?.phone}</span>
            </div>
            {user?.email && (
              <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 text-sm">
                <Mail size={13} />
                <span>{user.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Bookings', value: user?.totalBookings || 0, icon: '📋' },
            { label: 'Total Spent', value: `₹${(user?.totalSpent || 0).toLocaleString('en-IN')}`, icon: '💸' },
            { label: 'Wallet', value: `₹${user?.walletBalance || 0}`, icon: '👛' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="card p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <p className="font-bold text-slate-900 text-sm">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Referral */}
        {user?.referralCode && (
          <div className="card p-5 bg-gradient-to-r from-primary-50 to-indigo-50 border-primary-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">Your Referral Code</h3>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Earn ₹50/referral</span>
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-white border border-primary-200 rounded-xl px-4 py-2.5 text-primary-700 font-bold text-lg tracking-widest text-center">
                {user.referralCode}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(user.referralCode); toast.success('Copied!'); }}
                className="btn-primary py-2.5 px-4 text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Menu items */}
        <div className="card overflow-hidden">
          {menuItems.map(({ icon: Icon, label, action }, i) => (
            <button
              key={i}
              onClick={action}
              className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors ${i < menuItems.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <Icon size={18} className="text-slate-500" />
              <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors">
          <LogOut size={18} />
          Sign Out
        </button>

        <p className="text-center text-xs text-slate-300">ServiceHub v1.0 · Made with ❤️ in India</p>
      </div>
      <Footer />
    </div>
  );
}
