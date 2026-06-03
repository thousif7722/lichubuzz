import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Plus, Edit2, Trash2, Search, X, Check, EyeOff, ChevronDown, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Category → Subcategory map ──────────────────────────────────────────────
const CATEGORY_OPTIONS = {
  'AC Repair': {
    icon: '❄️',
    subcategories: ['Normal Service', 'Deep Clean', 'Gas Charging', 'Installation', 'Uninstallation', 'PCB Repair', 'Compressor Repair'],
  },
  'Washing Machine': {
    icon: '🫧',
    subcategories: ['Normal Service', 'Deep Clean', 'Repair', 'Installation', 'Drum Cleaning', 'Uninstallation'],
  },
  'Fridge & Cooler': {
    icon: '🧊',
    subcategories: ['Normal Service', 'Gas Refill', 'Repair', 'Deep Clean', 'Installation', 'Thermostat Repair'],
  },
  'Cleaning': {
    icon: '🧹',
    subcategories: ['Home Cleaning', 'Deep Clean', 'Bathroom Clean', 'Kitchen Clean', 'Sofa Clean', 'Carpet Clean'],
  },
  'Plumbing': {
    icon: '🔧',
    subcategories: ['Pipe Repair', 'Tap Fitting', 'Drainage Clean', 'Water Heater', 'Toilet Repair', 'Tank Cleaning'],
  },
  'Electrical': {
    icon: '⚡',
    subcategories: ['Wiring', 'Switch/Socket', 'Fan Installation', 'MCB/Fuse', 'Light Fitting', 'Inverter Setup'],
  },
  'Pest Control': {
    icon: '🐛',
    subcategories: ['Cockroach Treatment', 'Termite Treatment', 'Bed Bugs', 'Ant Control', 'Rodent Control', 'General Pest'],
  },
  'Carpentry': {
    icon: '🪚',
    subcategories: ['Furniture Repair', 'Door Fitting', 'Wardrobe', 'Shelf Fixing', 'Wood Polish', 'Custom Work'],
  },
  'Painting': {
    icon: '🎨',
    subcategories: ['Interior Paint', 'Exterior Paint', 'Texture Paint', 'Wall Putty', 'Waterproofing', 'Wood Paint'],
  },
  'Salon': {
    icon: '💇',
    subcategories: ['Haircut', 'Facial', 'Waxing', 'Manicure', 'Pedicure', 'Bridal Package'],
  },
};

const PRICE_TYPES = ['fixed', 'hourly', 'quote'];

const EMPTY_FORM = {
  name: '', slug: '', category: '', subcategory: '',
  description: '', basePrice: '', duration: 60,
  priceType: 'fixed', icon: '', isActive: true,
  tags: '', includes: '', excludes: '',
  popularityScore: 70, sortOrder: 99,
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiService.getServices();
      setServices(res.data.data || []);
    } catch { toast.error('Failed to load services'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEdit(svc) {
    setEditingId(svc._id);
    setForm({
      name: svc.name || '', slug: svc.slug || '',
      category: svc.category || '', subcategory: svc.subcategory || '',
      description: svc.description || '', basePrice: svc.basePrice || '',
      duration: svc.duration || 60, priceType: svc.priceType || 'fixed',
      icon: svc.icon || '', isActive: svc.isActive !== false,
      tags: (svc.tags || []).join(', '),
      includes: (svc.includes || []).join(', '),
      excludes: (svc.excludes || []).join(', '),
      popularityScore: svc.popularityScore ?? 70,
      sortOrder: svc.sortOrder ?? 99,
    });
    setIsModalOpen(true);
  }

  function set(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val };
      // Auto-fill icon from category
      if (key === 'category' && CATEGORY_OPTIONS[val]) {
        next.icon = next.icon || CATEGORY_OPTIONS[val].icon;
        next.subcategory = '';
      }
      // Auto-generate name + slug from category + subcategory
      if ((key === 'category' || key === 'subcategory')) {
        const cat = key === 'category' ? val : next.category;
        const sub = key === 'subcategory' ? val : next.subcategory;
        if (cat && sub) {
          const fullName = `${cat} - ${sub}`;
          if (!next.name || next.name.startsWith(cat)) next.name = fullName;
          next.slug = slugify(fullName);
        }
      }
      if (key === 'name') next.slug = slugify(val);
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        basePrice: parseInt(form.basePrice) || 0,
        duration: parseInt(form.duration) || 60,
        popularityScore: parseInt(form.popularityScore) || 70,
        sortOrder: parseInt(form.sortOrder) || 99,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        includes: form.includes ? form.includes.split(',').map(t => t.trim()).filter(Boolean) : [],
        excludes: form.excludes ? form.excludes.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      if (editingId) {
        await apiService.updateService(editingId, payload);
        toast.success('Service updated!');
      } else {
        await apiService.createService(payload);
        toast.success('Service created!');
      }
      setIsModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this service?')) return;
    try {
      await apiService.deleteService(id);
      toast.success('Service deactivated');
      load();
    } catch { toast.error('Failed'); }
  }

  const filtered = services.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || s.subcategory?.toLowerCase().includes(q);
    const matchCat = !filterCat || s.category === filterCat;
    return matchQ && matchCat;
  });

  const subcats = CATEGORY_OPTIONS[form.category]?.subcategories || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Services</h1>
            <p className="text-slate-500 text-sm mt-1">{services.length} services across {Object.keys(CATEGORY_OPTIONS).length} categories</p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Service
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 shadow-sm">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search services…"
              className="flex-1 outline-none text-sm text-slate-800 bg-transparent"
            />
            {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400" /></button>}
          </div>
          <select
            value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 shadow-sm outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {Object.keys(CATEGORY_OPTIONS).map(c => (
              <option key={c} value={c}>{CATEGORY_OPTIONS[c].icon} {c}</option>
            ))}
          </select>
        </div>

        {/* Services grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-44" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center bg-white p-10 rounded-2xl border border-slate-200">
            <div className="text-5xl mb-3">🛠️</div>
            <h2 className="text-lg font-semibold text-slate-800">No services found</h2>
            <button onClick={openAdd} className="btn-primary mt-4 inline-flex gap-2"><Plus size={16} /> Add Service</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(svc => (
              <div key={svc._id} className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition flex flex-col ${!svc.isActive ? 'opacity-55 border-dashed' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 text-xl flex items-center justify-center border border-primary-100 shrink-0">
                      {svc.icon || '🛠️'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 leading-tight text-sm">{svc.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{svc.category}</span>
                        {svc.subcategory && (
                          <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{svc.subcategory}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(svc)} className="text-slate-400 hover:text-primary-600 p-1.5 rounded-lg hover:bg-primary-50 transition">
                      <Edit2 size={14} />
                    </button>
                    {svc.isActive && (
                      <button onClick={() => handleDelete(svc._id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 flex-1 mb-3">{svc.description}</p>

                {svc.includes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {svc.includes.slice(0, 3).map(inc => (
                      <span key={inc} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">{inc}</span>
                    ))}
                    {svc.includes.length > 3 && <span className="text-[10px] text-slate-400">+{svc.includes.length - 3} more</span>}
                  </div>
                )}

                <div className="bg-slate-50 px-3 py-2 rounded-xl flex items-center justify-between text-sm border border-slate-100 mt-auto">
                  <span className="font-bold text-slate-900">₹{svc.basePrice?.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400 text-xs capitalize">{svc.priceType} · {svc.duration}m</span>
                  {!svc.isActive && <EyeOff size={13} className="text-red-400 ml-1" title="Inactive" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Service' : 'Add New Service'}</h2>
                <p className="text-sm text-slate-400 mt-0.5">Fill in the details below</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">

              {/* ── Step 1: Category & Subcategory ── */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Step 1 — Choose Category & Type</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
                    <select
                      required
                      value={form.category}
                      onChange={e => set('category', e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Select category…</option>
                      {Object.entries(CATEGORY_OPTIONS).map(([name, cfg]) => (
                        <option key={name} value={name}>{cfg.icon} {name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Service Type *</label>
                    <select
                      required
                      value={form.subcategory}
                      onChange={e => set('subcategory', e.target.value)}
                      disabled={!form.category}
                      className="input-field text-sm disabled:opacity-50"
                    >
                      <option value="">Select type…</option>
                      {subcats.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Step 2: Name, Slug, Icon ── */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Step 2 — Name & Identity</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Service Name *</label>
                    <input
                      required value={form.name}
                      onChange={e => set('name', e.target.value)}
                      className="input-field text-sm"
                      placeholder="e.g. AC Repair - Gas Charging"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Icon (Emoji)</label>
                    <input
                      value={form.icon}
                      onChange={e => set('icon', e.target.value)}
                      className="input-field text-sm text-center text-2xl"
                      placeholder="❄️"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Slug (URL-safe) *</label>
                  <input
                    required value={form.slug}
                    onChange={e => set('slug', e.target.value)}
                    className="input-field text-sm font-mono bg-white"
                  />
                </div>
              </div>

              {/* ── Step 3: Description ── */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description *</label>
                <textarea
                  required rows={3} value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className="input-field resize-none text-sm"
                  placeholder="What does this service include? What problem does it solve?"
                />
              </div>

              {/* ── Step 4: Pricing & Duration ── */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Step 3 — Pricing</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Base Price (₹) *</label>
                    <input
                      type="number" required min="0"
                      value={form.basePrice}
                      onChange={e => set('basePrice', e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="499"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (mins) *</label>
                    <input
                      type="number" required min="1"
                      value={form.duration}
                      onChange={e => set('duration', e.target.value)}
                      className="input-field font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Price Type</label>
                    <select
                      value={form.priceType}
                      onChange={e => set('priceType', e.target.value)}
                      className="input-field text-sm"
                    >
                      {PRICE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sort Order</label>
                    <input type="number" min="1" value={form.sortOrder} onChange={e => set('sortOrder', e.target.value)} className="input-field text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Popularity Score (0-100)</label>
                    <input type="number" min="0" max="100" value={form.popularityScore} onChange={e => set('popularityScore', e.target.value)} className="input-field text-sm font-mono" />
                  </div>
                </div>
              </div>

              {/* ── Step 5: Tags, Includes, Excludes ── */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1"><Tag size={11} /> Step 4 — What's Included</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Includes (comma-separated)</label>
                  <input
                    value={form.includes}
                    onChange={e => set('includes', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Gas refill, Leak check, Performance test"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Excludes (comma-separated)</label>
                  <input
                    value={form.excludes}
                    onChange={e => set('excludes', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Spare parts cost, Repair of leaks"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Search Tags (comma-separated)</label>
                  <input
                    value={form.tags}
                    onChange={e => set('tags', e.target.value)}
                    className="input-field text-sm"
                    placeholder="ac, gas, cooling, split ac"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
                  <div className={`block w-12 h-7 rounded-full transition-colors ${form.isActive ? 'bg-primary-500' : 'bg-slate-300'}`} />
                  <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Active — visible to customers</span>
              </label>

              {/* Buttons */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl btn-primary flex items-center justify-center gap-2 text-sm font-semibold">
                  {saving ? <span className="animate-spin">↻</span> : <Check size={16} />}
                  {saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Service')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
