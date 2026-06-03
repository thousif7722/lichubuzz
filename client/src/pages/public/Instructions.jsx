import React from 'react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { 
  PlayCircle, MapPin, CheckCircle2, 
  CreditCard, ShieldCheck, HelpCircle,
  Smartphone, Search, Clock
} from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    title: '1. Discover Services',
    desc: 'Browse through our extensive list of categories or use the search bar to find exactly what you need.'
  },
  {
    icon: MapPin,
    title: '2. Detect Location',
    desc: 'Our pinpoint GPS system automatically detects your service address for 100% accuracy.'
  },
  {
    icon: Clock,
    title: '3. Schedule & Pay',
    desc: 'Choose a time slot that works for you. Pay securely via UPI, Card, or choose Cash on Delivery.'
  },
  {
    icon: Smartphone,
    title: '4. Track Professional',
    desc: 'Watch your service pro arrive in real-time on our interactive map.'
  },
  {
    icon: ShieldCheck,
    title: '5. Secure Service',
    desc: 'Share the OTP with your pro to start the job. Rate your experience once the work is done!'
  }
];

export default function Instructions() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4">
              <PlayCircle size={28} />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">How it Works</h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Booking home services has never been easier. Follow these 5 simple steps to get started.
            </p>
          </div>

          {/* Steps Timeline */}
          <div className="space-y-12 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 before:hidden md:before:block">
            {STEPS.map((step, i) => (
              <div key={i} className="relative flex flex-col md:flex-row gap-6 md:gap-12 group">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center shrink-0 z-10 group-hover:scale-110 transition-transform duration-300">
                  <step.icon size={26} className="text-primary-600" />
                </div>
                <div className="flex-1 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 group-hover:border-primary-200 transition-colors">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{step.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Link */}
          <div className="mt-20 p-10 bg-white rounded-3xl shadow-sm border border-slate-100 text-center">
            <HelpCircle size={40} className="text-primary-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Still have questions?</h2>
            <p className="text-slate-500 mb-8">Our customer happiness team is available 24/7 to assist you.</p>
            <div className="flex flex-wrap justify-center gap-4">
               <button className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center gap-2">
                 Chat with us <CheckCircle2 size={18} />
               </button>
               <button className="bg-slate-100 text-slate-700 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                 Help Center
               </button>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
