import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Clock, Star, CheckCircle, ChevronLeft, Shield, XCircle, AlertCircle, ThumbsUp, User } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const HOW_IT_WORKS = [
  { icon: '📅', title: 'Pick date & time', desc: 'Choose a slot that works for you' },
  { icon: '👷', title: 'Pro is assigned', desc: 'Verified expert heads to your place' },
  { icon: '🔧', title: 'Job gets done', desc: 'Service completed to your satisfaction' },
  { icon: '💳', title: 'Pay after', desc: 'Pay only when work is done' },
];

export default function ServiceDetail() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    apiService.getServiceById(id)
      .then(r => setService(r.data.data))
      .catch(() => toast.error('Service not found'));
    apiService.getProviderReviews(id, { limit: 5 })
      .then(r => setReviews(r.data.data || []))
      .catch(() => {});
  }, [id]);

  if (!service) return (
    <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="pt-0">

        {/* ── Full-Screen Hero Image ── */}
        <div className="relative w-full h-64 sm:h-80 overflow-hidden">
          {/* Category background image */}
          <img
            src={`/cat_${service.category?.toLowerCase().replace(/\s+/g, '_').replace(/&/g, '')}.png`}
            alt={service.name}
            className="w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none'; }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />

          {/* Back button */}
          <Link
            to="/"
            className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors z-10"
          >
            <ChevronLeft size={20} />
          </Link>

          {/* Service info overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 text-white">
            <div className="flex items-end gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl shrink-0 shadow-xl border border-white/20">
                {service.icon || '🔧'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] bg-white/20 backdrop-blur-sm font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{service.category}</span>
                <h1 className="text-xl font-extrabold mt-1.5 leading-tight">{service.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-white/80">
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-amber-300 fill-amber-300" />
                    <span className="font-bold text-white">{service.rating?.toFixed(1) || '4.8'}</span>
                    <span className="text-white/60">({service.ratingCount || '2.4k'} reviews)</span>
                  </div>
                  <span>·</span>
                  <div className="flex items-center gap-1"><Clock size={12} />{service.duration} min</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

          {/* ── Tabs ── */}
          <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-100 gap-1">
            {[
              { id: 'overview', label: '📋 Overview' },
              { id: 'whats_included', label: '✅ Included' },
              { id: 'reviews', label: '⭐ Reviews' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <>
              {/* Price card */}
              <div className="card p-5 bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Starting at</p>
                    <p className="text-3xl font-extrabold text-primary-700">₹{service.basePrice}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Final price depends on work done</p>
                  </div>
                  <div className="text-right space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 justify-end">
                      <Clock size={12} className="text-primary-500" />
                      <span>{service.duration} min avg</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 justify-end">
                      <Shield size={12} className="text-emerald-500" />
                      <span>Insured service</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 justify-end">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      <span className="font-bold">{service.rating?.toFixed(1) || '4.8'} rated</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="card p-5">
                <h2 className="font-bold text-slate-800 mb-2.5 flex items-center gap-2">
                  📝 About this service
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">{service.description}</p>
              </div>

              {/* How it works */}
              <div className="card p-5">
                <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">⚙️ How it works</h2>
                <div className="space-y-4">
                  {HOW_IT_WORKS.map(({ icon, title, desc }, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center text-lg shrink-0">{icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                          <p className="font-semibold text-slate-800 text-sm">{title}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 ml-7">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety & Trust */}
              <div className="card p-5">
                <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Shield size={15} className="text-emerald-600" /> Our Promise
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: '🔍', label: 'Background verified' },
                    { icon: '🪪', label: 'ID checked' },
                    { icon: '🛡️', label: 'Fully insured' },
                    { icon: '💯', label: 'Quality guarantee' },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                      <span className="text-lg">{icon}</span>
                      <span className="text-xs font-semibold text-slate-700">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── WHAT'S INCLUDED TAB ── */}
          {activeTab === 'whats_included' && (
            <div className="card p-5 space-y-4">
              {service.includes?.length > 0 ? (
                <>
                  <div>
                    <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <CheckCircle size={15} className="text-green-500" /> What's included
                    </h2>
                    <div className="space-y-2.5">
                      {service.includes.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-2.5 bg-green-50 rounded-xl">
                          <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-700 font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {service.excludes?.length > 0 && (
                    <div>
                      <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <XCircle size={15} className="text-red-400" /> What's NOT included
                      </h2>
                      <div className="space-y-2.5">
                        {service.excludes.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-2.5 bg-red-50 rounded-xl">
                            <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-600">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">Details will be confirmed by the provider on visit</p>
                </div>
              )}

              {/* Price note */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex gap-2.5">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Base price is ₹{service.basePrice}. Extra charges may apply for additional materials or severe issues — always confirmed before proceeding.
                </p>
              </div>
            </div>
          )}

          {/* ── REVIEWS TAB ── */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="card p-5 flex items-center gap-6">
                <div className="text-center">
                  <div className="text-5xl font-extrabold text-slate-900">{service.rating?.toFixed(1) || '4.8'}</div>
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={14} className={s <= Math.round(service.rating || 4.8) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{service.ratingCount || '2,400'}+ reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(star => (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-4">{star}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${star === 5 ? 70 : star === 4 ? 20 : star === 3 ? 7 : star === 2 ? 2 : 1}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {reviews.length > 0 ? reviews.map((r, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 text-sm">
                      {r.customerId?.name?.[0] || 'C'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{r.customerId?.name || 'Customer'}</p>
                      <p className="text-xs text-slate-400">{dayjs(r.createdAt).format('D MMM YYYY')}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} className={s <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-slate-600 leading-relaxed">{r.comment}</p>}
                  {r.isVerified && (
                    <div className="flex items-center gap-1 mt-2 text-emerald-600 text-xs font-medium">
                      <ThumbsUp size={11} /> Verified booking
                    </div>
                  )}
                </div>
              )) : (
                <div className="card p-8 text-center">
                  <Star size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-500 text-sm">No reviews yet — be the first to book!</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Sticky Book Button ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">Starting at</p>
            <p className="text-2xl font-extrabold text-slate-900">₹{service.basePrice}</p>
          </div>
          <Link
            to={`/book/${service._id}`}
            className="flex-1 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl text-base text-center shadow-lg shadow-primary-200 transition-all hover:shadow-xl"
          >
            Book Now →
          </Link>
        </div>
      </div>
    </div>
  );
}
