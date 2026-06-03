import React from 'react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { Shield, Lock, Eye, FileText, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-primary-600 mb-8 transition-colors"
        >
          <ChevronLeft size={20} /> Back
        </button>

        <div className="space-y-12">
          <header className="text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield size={32} />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Privacy Policy</h1>
            <p className="text-slate-500">Last updated: May 29, 2026</p>
          </header>

          <section className="prose prose-slate max-w-none">
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 mb-12">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Lock className="text-primary-500" size={20} /> Your Privacy Matters
              </h2>
              <p className="text-slate-600 leading-relaxed">
                At ServiceHub, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information when you use our platform for booking home services.
              </p>
            </div>

            <div className="space-y-8">
              {[
                {
                  icon: Eye,
                  title: '1. Information We Collect',
                  content: 'We collect information you provide directly to us, such as your name, phone number, email address, and service address. We also collect precise GPS location data during the booking process to ensure accurate service delivery.'
                },
                {
                  icon: Shield,
                  title: '2. How We Use Information',
                  content: 'Your data is primarily used to facilitate service bookings, track provider arrivals, and process payments. We may also use your contact details to send important service updates or safety alerts.'
                },
                {
                  icon: FileText,
                  title: '3. Data Sharing',
                  content: 'We share your contact details and service address with the assigned service professional ONLY for the duration of the job. We do not sell your personal data to third parties.'
                },
                {
                  icon: Lock,
                  title: '4. Data Security',
                  content: 'We implement robust security measures, including encryption and strict access controls, to protect your data from unauthorized access or disclosure.'
                }
              ].map((item, i) => (
                <div key={i} className="group">
                  <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all">
                      <item.icon size={18} />
                    </span>
                    {item.title}
                  </h3>
                  <p className="text-slate-600 pl-11 leading-relaxed">{item.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 p-8 rounded-3xl bg-primary-900 text-white text-center">
              <h3 className="text-xl font-bold mb-3">Questions about your privacy?</h3>
              <p className="text-primary-100 mb-6 text-sm">Our support team is here to help with any data-related queries.</p>
              <a href="mailto:support@servicehub.com" className="bg-white text-primary-900 px-8 py-3 rounded-xl font-bold hover:bg-primary-50 transition-colors">
                Contact Privacy Team
              </a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
