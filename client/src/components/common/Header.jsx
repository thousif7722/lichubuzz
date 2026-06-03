import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Bell, LogOut, User, Menu, X, Home, BookOpen,
  Briefcase, DollarSign, Settings, Shield, BarChart2,
} from 'lucide-react';
import { logout, selectUser } from '@/store/slices/authSlice';
import { selectUnreadCount, markAllRead } from '@/store/slices/notificationSlice';
import { fetchNotifications, selectNotifications } from '@/store/slices/notificationSlice';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const NAV_LINKS = {
  customer: [
    { to: '/',           label: 'Home',     icon: Home },
    { to: '/bookings',   label: 'Bookings', icon: BookOpen },
    { to: '/profile',    label: 'Profile',  icon: User },
  ],
  provider: [
    { to: '/provider',            label: 'Dashboard', icon: Home },
    { to: '/provider/bookings',   label: 'Jobs',       icon: Briefcase },
    { to: '/provider/earnings',   label: 'Earnings',   icon: DollarSign },
    { to: '/provider/profile',    label: 'Profile',    icon: Settings },
  ],
  // Admin/Staff links are computed dynamically based on permissions
};

export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const unreadCount = useSelector(selectUnreadCount);
  const notifications = useSelector(selectNotifications);

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const role = user?.role || 'customer';
  let links = NAV_LINKS[role] || NAV_LINKS.customer;

  if (role === 'admin' || role === 'staff') {
    const p = user?.permissions || [];
    const has = (perm) => role === 'admin' || p.includes(perm);

    links = [{ to: '/admin', label: 'Dashboard', icon: BarChart2 }];
    
    if (has('manage_bookings')) links.push({ to: '/admin/bookings', label: 'Bookings', icon: BookOpen });
    if (has('manage_providers')) links.push({ to: '/admin/providers', label: 'Providers', icon: Shield });
    if (has('manage_complaints')) links.push({ to: '/admin/complaints', label: 'Complaints', icon: Bell });
    if (has('manage_financials')) links.push({ to: '/admin/financials', label: 'Financials', icon: DollarSign });
    if (has('manage_services')) links.push({ to: '/admin/services', label: 'Services', icon: Briefcase });
    if (has('manage_users')) links.push({ to: '/admin/users', label: 'Users', icon: User });
    
    if (role === 'admin') {
      links.push({ to: '/admin/team', label: 'Team', icon: Briefcase });
      links.push({ to: '/admin/announcements', label: 'Announcements', icon: Bell });
    }
  }

  useEffect(() => {
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    dispatch(logout());
    navigate('/login');
  }

  function handleNotifOpen() {
    setNotifOpen(v => !v);
    if (!notifOpen && unreadCount > 0) {
      dispatch(markAllRead());
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to={role === 'admin' ? '/admin' : role === 'provider' ? '/provider' : '/'} className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-primary-700">⚡ ServiceHub</span>
          {role !== 'customer' && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-red-100 text-red-700' : role === 'staff' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
              {role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Pro'}
            </span>
          )}
          {role === 'customer' && user?.isPlusMember && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-sm uppercase tracking-wider ml-1">
              ★ Plus
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === to
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          {role === 'customer' && !user?.isPlusMember && (
            <Link
              to="/plus"
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm"
            >
              ★ Get Plus
            </Link>
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleNotifOpen}
              className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-elevated border border-slate-100 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                  {unreadCount > 0 && <span className="text-xs text-primary-600 font-medium">{unreadCount} new</span>}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">No notifications yet</div>
                  ) : (
                    notifications.slice(0, 15).map((n, i) => (
                      <div key={i} className={`px-4 py-3 ${!n.isRead ? 'bg-primary-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{n.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                          </div>
                          {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{dayjs(n.createdAt).fromNow()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400">{user?.phone}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600"
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                location.pathname === to ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon size={17} /> {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
