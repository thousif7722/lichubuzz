import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, ChevronRight, Clock, TrendingUp, ArrowRight, X, Shield, Play, Sparkles } from 'lucide-react';
import {
  fetchServices, fetchCategories,
  setSelectedCategory, setSearch,
  selectServices, selectCategories,
  selectSelectedCategory, selectServiceLoading,
} from '@/store/slices/serviceSlice';
import { selectUser } from '@/store/slices/authSlice';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { CardSkeleton } from '@/components/common/UI';

// ── Category config with REAL images (Urban Company style)
const CATEGORY_CONFIG = {
  'AC Repair':        { img: '/cat_ac.png',        light: '#e0f2fe', accent: '#0284c7', icon: '❄️' },
  'Cleaning':         { img: '/cat_cleaning.png',  light: '#d1fae5', accent: '#059669', icon: '🧹' },
  'Washing Machine':  { img: '/cat_washing.png',   light: '#eff6ff', accent: '#3b82f6', icon: '🫧' },
  'Fridge & Cooler':  { img: '/cat_fridge.png',    light: '#f0f9ff', accent: '#0ea5e9', icon: '🧊' },
  'Plumbing':         { img: '/cat_plumbing.png',  light: '#f1f5f9', accent: '#475569', icon: '🔧' },
  'Electrical':       { img: '/cat_electrical.png',light: '#fef3c7', accent: '#d97706', icon: '⚡' },
  'Pest Control':     { img: '/cat_pest.png',      light: '#f0fdf4', accent: '#65a30d', icon: '🐛' },
  'Carpentry':        { img: '/cat_carpentry.png', light: '#fff7ed', accent: '#ea580c', icon: '🪚' },
  'Painting':         { img: '/cat_painting.png',  light: '#fdf2f8', accent: '#db2777', icon: '🎨' },
  'Salon':            { img: '/cat_salon.png',     light: '#f5f3ff', accent: '#7c3aed', icon: '💇' },
};

const ALL_CATS = Object.keys(CATEGORY_CONFIG);

const BANNERS = [
  { bg: 'linear-gradient(135deg,#1d4ed8 0%,#4338ca 100%)', label: 'AC Service & Repair', icon: '❄️', desc: 'Starting ₹499', tag: '🔥 Most Booked' },
  { bg: 'linear-gradient(135deg,#059669 0%,#0d9488 100%)', label: 'Deep Home Cleaning',  icon: '🏠', desc: 'From ₹1,499',   tag: '⭐ Top Rated' },
  { bg: 'linear-gradient(135deg,#d97706 0%,#b45309 100%)', label: 'Electrical Fixes',    icon: '⚡', desc: 'From ₹299',    tag: '⚡ Quick Fix' },
  { bg: 'linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)', label: 'Salon at Home',       icon: '💇', desc: 'From ₹399',    tag: '✨ New' },
];

const VIDEO_ADS = [
  {
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    title: 'AC Service & Repair',
    desc: 'Beat the heat — certified AC experts at your home today',
    badge: '🔥 Most Booked',
    cta: 'Book AC Service',
    category: 'AC Repair',
  },
  {
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    title: 'Home Deep Cleaning',
    desc: 'Sparkling clean homes in just 4 hours by our experts',
    badge: '⭐ Top Rated',
    cta: 'Book Cleaning',
    category: 'Cleaning',
  },
  {
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    title: 'Plumbing & Electrical',
    desc: 'Expert plumbers & electricians at your door in 60 mins',
    badge: '⚡ Express',
    cta: 'Book Now',
    category: 'Plumbing',
  },
];

const CONTENT_TYPES = [
  { label: 'New Launches', icon: '🚀', color: '#f0f9ff', accent: '#0369a1' },
  { label: 'Best Offers', icon: '🎁', color: '#fdf2f8', accent: '#be185d' },
  { label: 'Top Rated', icon: '⭐', color: '#fefce8', accent: '#a16207' },
  { label: 'Recently Viewed', icon: '🕒', color: '#f0fdfa', accent: '#0f766e' },
];

const TRUST_STATS = [
  { value: '10M+', label: 'Customers', icon: '😊' },
  { value: '50K+', label: 'Experts',   icon: '👷' },
  { value: '4.8★', label: 'Rating',    icon: '⭐' },
  { value: '200+', label: 'Cities',    icon: '🌆' },
];

// ── Category Services Drawer (slides up from bottom like Urban Company)
function CategoryDrawer({ category, services, onClose, navigate }) {
  const cfg = CATEGORY_CONFIG[category] || { icon: '🔧', bg: '#334155', light: '#f8fafc' };
  const catServices = services.filter(s =>
    s.category?.toLowerCase() === category.toLowerCase()
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease' }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
        style={{ animation: 'slideUp 0.3s cubic-bezier(.22,1,.36,1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Category header */}
        <div className="px-5 py-4 shrink-0" style={{ background: cfg.light }}>
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/80 text-slate-500 hover:bg-white">
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shrink-0">
              <img src={cfg.img} alt={category} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; e.target.parentNode.style.background=cfg.accent; e.target.parentNode.innerHTML=`<span style='font-size:2rem;display:flex;align-items:center;justify-content:center;height:100%'>${cfg.icon}</span>`; }} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{category}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{catServices.length} services available</p>
            </div>
          </div>
        </div>

        {/* Services list */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {catServices.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold text-slate-600">No services in this category yet</p>
              <p className="text-sm mt-1">Check back soon!</p>
            </div>
          ) : (
            catServices.map(service => (
              <button
                key={service._id}
                onClick={() => { onClose(); navigate(`/services/${service._id}`); }}
                className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 hover:border-blue-200 hover:shadow-md transition-all flex items-center gap-4 group"
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: cfg.light }}
                >
                  {service.icon || cfg.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm leading-snug">{service.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{service.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1">
                      <Star size={10} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs text-slate-500 font-medium">{service.rating?.toFixed(1) || '4.8'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={10} />
                      <span>{service.duration} min</span>
                    </div>
                  </div>
                </div>

                {/* Price + arrow */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">from</p>
                  <p className="text-lg font-extrabold text-blue-700">₹{service.basePrice}</p>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 ml-auto mt-1 transition-colors" />
                </div>
              </button>
            ))
          )}
          <div className="h-4" />
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const services = useSelector(selectServices);
  const categories = useSelector(selectCategories);
  const selectedCategory = useSelector(selectSelectedCategory);
  const loading = useSelector(selectServiceLoading);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [drawerCategory, setDrawerCategory] = useState(null);
  const [detectedLocation, setDetectedLocation] = useState(null); // { area, city }
  const [locationLoading, setLocationLoading] = useState(true);
  const searchRef = useRef(null);

  useEffect(() => {
    dispatch(fetchServices({ category: selectedCategory !== 'All' ? selectedCategory : undefined }));
    dispatch(fetchCategories());
  }, [dispatch, selectedCategory]);

  // Fetch all services once for drawer
  useEffect(() => {
    dispatch(fetchServices({}));
  }, [dispatch]);

  useEffect(() => {
    const t = setInterval(() => setActiveBanner(v => (v + 1) % BANNERS.length), 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 📍 Rapido-style: Auto detect location on mount
  useEffect(() => {
    setLocationLoading(true);
    if (!navigator.geolocation) {
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const a = data.address;
          const area = a.suburb || a.neighbourhood || a.village || a.town || a.county || '';
          const city = a.city || a.state_district || a.state || '';
          setDetectedLocation({ area, city });
        } catch {
          // silently fail — fallback to user address / 'Select Location'
        } finally {
          setLocationLoading(false);
        }
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const topRated = [...services].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6);

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f8fafc' }}>
      <Header />
      <div className="pt-16">

        {/* ── HERO ── */}
        <div style={{ background: 'linear-gradient(160deg,#1e3a8a 0%,#1d4ed8 50%,#4338ca 100%)' }} className="text-white px-4 pt-6 pb-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30%,-40%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(-30%,40%)' }} />

          <div className="max-w-2xl mx-auto relative">
          <button className="flex items-center gap-1.5 text-blue-200 text-sm mb-4 hover:text-white transition-colors group">
              <MapPin size={14} className="shrink-0 group-hover:text-white" />
              {locationLoading ? (
                <span className="font-medium animate-pulse">Detecting location…</span>
              ) : detectedLocation ? (
                <span className="font-medium">
                  {detectedLocation.area && <span className="text-white">{detectedLocation.area}, </span>}
                  {detectedLocation.city}
                </span>
              ) : (
                <span className="font-medium">{user?.addresses?.[0]?.city || 'Select Location'}</span>
              )}
              <ChevronRight size={13} className="rotate-90" />
            </button>

            <h1 className="text-2xl font-bold mb-1">Hello, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
            <p className="text-blue-200 text-sm mb-6">Premium home services at your doorstep</p>

            {/* Search */}
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowDropdown(true)}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                placeholder="Search AC repair, cleaning, salon…"
                className="w-full bg-white text-slate-800 pl-11 pr-10 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-white/50 shadow-2xl placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
              )}

              {/* Quick Search Dropdown (Amazon/Flipkart style) */}
              {showDropdown && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl z-50 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[400px] overflow-y-auto">
                    {filtered.length > 0 ? (
                      <div>
                        <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Related Services</div>
                        {filtered.slice(0, 8).map(s => (
                          <button
                            key={s._id}
                            onClick={() => navigate(`/services/${s._id}`)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors text-left group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl shrink-0 group-hover:bg-white group-hover:shadow-sm transition-all">
                              {s.icon || '🔧'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-slate-800 group-hover:text-blue-700 transition-colors truncate">{s.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{s.category}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-blue-600">₹{s.basePrice}</p>
                              <ArrowRight size={12} className="text-slate-300 ml-auto mt-0.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-6 py-10 text-center text-slate-400">
                        <div className="text-4xl mb-2">🔎</div>
                        <p className="text-sm font-semibold">No services found for "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 -mt-12 pb-10 space-y-6">

          {/* ── Banner Carousel ── */}
          <div className="relative overflow-hidden rounded-3xl shadow-xl h-36">
            {BANNERS.map((b, i) => (
              <div
                key={i}
                className="absolute inset-0 flex items-center justify-between px-6 transition-all duration-700 ease-in-out"
                style={{
                  background: b.bg,
                  opacity: i === activeBanner ? 1 : 0,
                  transform: i === activeBanner ? 'scale(1)' : 'scale(0.97)',
                  pointerEvents: i === activeBanner ? 'auto' : 'none',
                }}
              >
                <div className="text-white">
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block">{b.tag}</span>
                  <div className="text-xl font-bold leading-tight">{b.label}</div>
                  <div className="text-sm opacity-80 mt-0.5">{b.desc}</div>
                </div>
                <div className="text-7xl drop-shadow-lg">{b.icon}</div>
              </div>
            ))}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {BANNERS.map((_, i) => (
                <button key={i} onClick={() => setActiveBanner(i)} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === activeBanner ? 24 : 6, background: i === activeBanner ? 'white' : 'rgba(255,255,255,0.4)' }} />
              ))}
            </div>
          </div>


          {/* ── Content Type Slides ── */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1">
            {CONTENT_TYPES.map((type, i) => (
              <button key={i} className="flex flex-col items-center gap-2 shrink-0 group">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-sm border border-slate-100 group-hover:scale-110 group-hover:shadow-md transition-all duration-300"
                  style={{ background: type.color }}
                >
                  {type.icon}
                </div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tight group-hover:text-primary-600 transition-colors">{type.label}</span>
              </button>
            ))}
          </div>

          {/* ── UC-Style Category Grid ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">What are you looking for?</h2>
              <button onClick={() => document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-blue-600 text-sm font-semibold flex items-center gap-1">
                See all <ArrowRight size={13} />
              </button>
            </div>

          <div className="grid grid-cols-4 gap-3">
              {ALL_CATS.map(name => {
                const cfg = CATEGORY_CONFIG[name];
                return (
                  <button
                    key={name}
                    onClick={() => navigate(`/category/${encodeURIComponent(name)}`)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    {/* Real image tile — UC style */}
                    <div
                      className="w-full rounded-2xl overflow-hidden shadow-md transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl relative"
                      style={{ aspectRatio: '1 / 1' }}
                    >
                      <img
                        src={cfg.img}
                        alt={name}
                        className="w-full h-full object-cover"
                        onError={e => {
                          e.target.style.display = 'none';
                          e.target.parentNode.style.background = cfg.accent;
                          e.target.parentNode.innerHTML += `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem">${cfg.icon}</span>`;
                        }}
                      />
                      {/* Dark gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </div>
                    <span className="text-xs text-slate-700 font-semibold text-center leading-tight">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Trust Stats ── */}
          <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(135deg,#1d4ed8 0%,#4338ca 100%)' }}>
            <div className="grid grid-cols-4 gap-2 text-white text-center">
              {TRUST_STATS.map(({ value, label, icon }) => (
                <div key={label}>
                  <div className="text-xl mb-0.5">{icon}</div>
                  <div className="text-base font-extrabold leading-none">{value}</div>
                  <div className="text-[10px] text-blue-200 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Top Rated Services (horizontal scroll) ── */}
          {topRated.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp size={17} className="text-blue-600" /> Top Rated Near You
                </h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {topRated.map(service => {
                  const cfg = CATEGORY_CONFIG[service.category] || { icon: '🔧', bg: '#334155', light: '#f1f5f9' };
                  return (
                    <Link
                      key={service._id}
                      to={`/services/${service._id}`}
                      className="shrink-0 w-44 bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all block"
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3" style={{ background: cfg.light }}>
                        {service.icon || cfg.icon}
                      </div>
                      <p className="font-bold text-slate-800 text-sm leading-snug mb-1 line-clamp-2">{service.name}</p>
                      <div className="flex items-center gap-1 mb-2">
                        <Star size={11} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs text-slate-500">{service.rating?.toFixed(1) || '4.8'}</span>
                      </div>
                      <p className="text-blue-700 font-extrabold text-sm">₹{service.basePrice}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Search Results / All Services ── */}
          {searchQuery && (
            <div id="services-section">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800">
                  Search Results
                  <span className="ml-2 text-slate-400 font-normal text-sm">({filtered.length})</span>
                </h2>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-5xl mb-3">🔍</div>
                  <p className="font-semibold text-slate-600">No services found</p>
                  <p className="text-sm mt-1">Try a different search or browse categories above</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map(service => <ServiceCard key={service._id} service={service} />)}
                </div>
              )}
            </div>
          )}

          {/* ── Safety Guarantee ── */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Shield size={16} className="text-emerald-600" /> ServiceHub Guarantee
            </h3>
            <div className="space-y-2.5">
              {[
                { icon: '✅', text: 'Background-verified professionals' },
                { icon: '🔒', text: 'Safe & insured service visits' },
                { icon: '💯', text: '100% satisfaction or free redo' },
                { icon: '📞', text: '24/7 customer support' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Category Services Drawer ── */}
      {drawerCategory && (
        <CategoryDrawer
          category={drawerCategory}
          services={services}
          onClose={() => setDrawerCategory(null)}
          navigate={navigate}
        />
      )}
      <Footer />
    </div>
  );
}

function ServiceCard({ service }) {
  const cfg = CATEGORY_CONFIG[service.category] || { icon: '🔧', bg: '#334155', light: '#f1f5f9' };
  return (
    <Link to={`/services/${service._id}`} className="bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 block group">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform" style={{ background: cfg.light }}>
          {service.icon || cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors">{service.name}</h3>
          <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">{service.description}</p>
          <div className="flex items-center justify-between mt-2.5">
            <div>
              <span className="text-xs text-slate-400">from </span>
              <span className="text-blue-700 font-extrabold text-base">₹{service.basePrice}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <Star size={11} className="text-amber-400 fill-amber-400" />
                <span>{service.rating?.toFixed(1) || '4.8'}</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>{service.duration}m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
