import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle2, Shield, Zap } from 'lucide-react';
import Header from '@/components/common/Header';
import { selectUser, selectAuthLoading, activatePlusMembership } from '@/store/slices/authSlice';

export default function PlusMembership() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const loading = useSelector(selectAuthLoading);

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    await dispatch(activatePlusMembership());
    // Auto redirect home on success
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-24 max-w-lg mx-auto px-4">
        
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-24 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full translate-y-16 -translate-x-12" />

          <div className="relative z-10 text-center">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl mb-4">
              <Sparkles size={32} className="text-white" />
            </span>
            <h1 className="text-3xl font-extrabold mb-1">ServiceHub <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">Plus</span></h1>
            <p className="text-slate-300 text-sm mb-6">Upgrade to experience premium home services without the extra costs.</p>
            
            {user?.isPlusMember ? (
              <div className="bg-white/10 rounded-2xl p-4 border border-white/20 backdrop-blur-sm">
                <p className="font-bold text-lg text-emerald-400 flex items-center justify-center gap-2">
                  <CheckCircle2 /> You are already a Plus Member!
                </p>
                <p className="text-sm text-slate-300 mt-2">Enjoy your 10% discount and zero surge fees on all bookings.</p>
              </div>
            ) : (
              <button 
                onClick={handleSubscribe} 
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-900 font-bold py-4 rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Activating...' : 'Get 6 Months for ₹299'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 ml-2">Exclusive Plus Benefits</h2>

          <div className="bg-white p-5 rounded-2xl shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Zero Surge Pricing</h3>
              <p className="text-sm text-slate-500 mt-1">Book services during peak morning or evening hours without ever paying extra multipliers.</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-2xl font-black">%</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Flat 10% Discount</h3>
              <p className="text-sm text-slate-500 mt-1">Enjoy an automatic flat 10% off the base price of every service you book on ServiceHub.</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Priority Support & Assignment</h3>
              <p className="text-sm text-slate-500 mt-1">Your bookings get assigned to our top-rated Gold tier professionals first, with dedicated support.</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
