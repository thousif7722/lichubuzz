import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ChevronLeft, Search, SlidersHorizontal, Star, Clock, ShieldCheck,
  Plus, Minus, ShoppingCart, X, ChevronRight, Zap, Info,
} from 'lucide-react';
import { selectUser } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import toast from 'react-hot-toast';

// ── Category visual map (mirrors CATEGORY_CONFIG in HomePage) ─────────────────
const CATEGORY_META = {
  'AC Repair':        { img: '/cat_ac.png',        icon: '❄️',  accent: '#0284c7', light: '#e0f2fe' },
  'Cleaning':         { img: '/cat_cleaning.png',  icon: '🧹',  accent: '#059669', light: '#d1fae5' },
  'Washing Machine':  { img: '/cat_washing.png',   icon: '🫧',  accent: '#3b82f6', light: '#eff6ff' },
  'Fridge & Cooler':  { img: '/cat_fridge.png',    icon: '🧊',  accent: '#0ea5e9', light: '#f0f9ff' },
  'Plumbing':         { img: '/cat_plumbing.png',  icon: '🔧',  accent: '#475569', light: '#f1f5f9' },
  'Electrical':       { img: '/cat_electrical.png',icon: '⚡',  accent: '#d97706', light: '#fef3c7' },
  'Pest Control':     { img: '/cat_pest.png',       icon: '🐛',  accent: '#65a30d', light: '#f0fdf4' },
  'Carpentry':        { img: '/cat_carpentry.png', icon: '🪚',  accent: '#ea580c', light: '#fff7ed' },
  'Painting':         { img: '/cat_painting.png',  icon: '🎨',  accent: '#db2777', light: '#fdf2f8' },
  'Salon':            { img: '/cat_salon.png',      icon: '💇',  accent: '#7c3aed', light: '#f5f3ff' },
};

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

// ── Skeleton loader ─────────────────────────────────────────────────────────────
function ServiceSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-xl bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-2/3" />
          <div className="h-6 bg-slate-200 rounded w-1/3 mt-2" />
        </div>
      </div>
      <div className="mt-4 h-10 bg-slate-200 rounded-xl" />
    </div>
  );
}

// ── Service Card ────────────────────────────────────────────────────────────────
function ServiceCard({ service, qty, onQtyChange, onBook, accentColor }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="p-5">
        <div className="flex gap-4">
          {/* Service image / icon */}
          <div
            className="w-24 h-24 rounded-xl shrink-0 flex items-center justify-center text-4xl overflow-hidden"
            style={{ background: `${accentColor}15` }}
          >
            {service.image ? (
              <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
            ) : (
              <span>{service.icon || '🔧'}</span>
            )}
          </div>

          {/* Service info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base leading-tight">{service.name}</h3>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                <Clock size={10} /> {service.duration || 60} min
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <ShieldCheck size={10} /> Verified Pro
              </span>
              {service.popularityScore > 70 && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                  <Star size={10} fill="currentColor" /> Popular
                </span>
              )}
            </div>

            {/* Description */}
            <p className={`text-xs text-slate-500 mt-1.5 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
              {service.description}
            </p>
            {service.description?.length > 80 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs font-medium mt-0.5 flex items-center gap-0.5"
                style={{ color: accentColor }}
              >
                {expanded ? 'Less' : 'More'} <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-xl font-extrabold text-slate-900">₹{(service.basePrice * qty).toLocaleString('en-IN')}</span>
              {qty > 1 && (
                <span className="text-xs text-slate-400">(₹{service.basePrice} × {qty})</span>
              )}
            </div>
          </div>
        </div>

        {/* Includes list */}
        {expanded && service.includes?.length > 0 && (
          <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 mb-1.5">What's included:</p>
            <ul className="space-y-1">
              {service.includes.map((item, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quantity + Book */}
        <div className="mt-4 flex items-center gap-3">
          {/* Quantity selector */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => onQtyChange(service._id, Math.max(1, qty - 1))}
              className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-transform"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center font-bold text-slate-900 text-sm">{qty}</span>
            <button
              onClick={() => onQtyChange(service._id, Math.min(10, qty + 1))}
              className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-transform"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Book Now button */}
          <button
            onClick={() => onBook(service, qty)}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
          >
            <Zap size={15} /> Book Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CategoryServicesPage() {
  const { categoryName } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const decoded = useMemo(() => {
    try { return decodeURIComponent(categoryName); } catch { return categoryName; }
  }, [categoryName]);

  const meta = CATEGORY_META[decoded] || { img: null, icon: '🔧', accent: '#6366f1', light: '#f0f4ff' };

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [quantities, setQuantities] = useState({}); // serviceId → qty
  const [showFilter, setShowFilter] = useState(false);

  // Fetch services from API
  useEffect(() => {
    setLoading(true);
    setError(null);
    apiService.getServices({ category: decoded, sort })
      .then(res => {
        const data = res.data?.data || [];
        setServices(data);
        // Default all quantities to 1
        const init = {};
        data.forEach(s => { init[s._id] = 1; });
        setQuantities(init);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load services. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [decoded, sort]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [services, search]);

  const handleQtyChange = useCallback((id, qty) => {
    setQuantities(prev => ({ ...prev, [id]: qty }));
  }, []);

  const handleBook = useCallback((service, qty) => {
    navigate(`/book/${service._id}?qty=${qty}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hero banner */}
      <div className="relative overflow-hidden" style={{ paddingTop: '4rem' }}>
        <div className="relative h-44 sm:h-52 overflow-hidden">
          {meta.img && (
            <img
              src={meta.img}
              alt={decoded}
              className="w-full h-full object-cover"
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 pb-6">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{meta.icon}</span>
              <div>
                <h1 className="text-2xl font-extrabold text-white leading-tight">{decoded}</h1>
                <p className="text-white/70 text-sm mt-0.5">
                  {loading ? '…' : `${filtered.length} service${filtered.length !== 1 ? 's' : ''} available`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort bar */}
      <div className="sticky top-14 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search in ${decoded}…`}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          {/* Sort button */}
          <button
            onClick={() => setShowFilter(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${showFilter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            <SlidersHorizontal size={15} />
            Sort
          </button>
        </div>

        {/* Sort dropdown */}
        {showFilter && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 flex-wrap">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setSort(opt.value); setShowFilter(false); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  sort === opt.value
                    ? 'text-white border-transparent'
                    : 'border-slate-200 text-slate-600 bg-white'
                }`}
                style={sort === opt.value ? { background: meta.accent, borderColor: meta.accent } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trust badges */}
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { icon: '✅', text: 'Background Verified' },
            { icon: '⏱️', text: 'On-Time Guarantee' },
            { icon: '🔄', text: 'Free Re-service' },
            { icon: '💳', text: 'Pay After Service' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm shrink-0">
              <span>{b.icon}</span> {b.text}
            </div>
          ))}
        </div>
      </div>

      {/* Services list */}
      <div className="max-w-2xl mx-auto px-4 pb-32 space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <ServiceSkeleton key={i} />)
        ) : error ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-slate-600 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: meta.accent }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-slate-800">No services found</h3>
            <p className="text-slate-500 text-sm mt-1">
              {search ? `No results for "${search}"` : `No services available in ${decoded} yet.`}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-4 text-sm font-medium underline"
                style={{ color: meta.accent }}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          filtered.map(service => (
            <ServiceCard
              key={service._id}
              service={service}
              qty={quantities[service._id] || 1}
              onQtyChange={handleQtyChange}
              onBook={handleBook}
              accentColor={meta.accent}
            />
          ))
        )}
      </div>

      {/* Floating "View Details" hint on first load */}
      {!loading && filtered.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full shadow-xl pointer-events-auto">
            <Info size={13} />
            Tap <strong>"More"</strong> on any card to see what's included
          </div>
        </div>
      )}
    </div>
  );
}
