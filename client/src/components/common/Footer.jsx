import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Send, Mail, Phone, MapPin, Facebook, Twitter, 
  Instagram, Youtube, Loader, CheckCircle2,
  ExternalLink, ShieldCheck, Info
} from 'lucide-react';
import { apiService } from '@/services/api';
import toast from 'react-hot-toast';

const SECTIONS = [
  {
    title: 'Services',
    links: [
      { label: 'AC Repair & Service', to: '/category/AC%20Repair' },
      { label: 'Home Cleaning', to: '/category/Cleaning' },
      { label: 'Washing Machine Repair', to: '/category/Washing%20Machine' },
      { label: 'Electrical Works', to: '/category/Electrical' },
      { label: 'Plumbing Service', to: '/category/Plumbing' },
    ]
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', to: '/' },
      { label: 'Careers', to: '/careers' },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Instructions', to: '/instructions' },
    ]
  }
];

export default function Footer() {
  const [supportData, setSupportData] = useState({ email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSupportSubmit(e) {
    e.preventDefault();
    if (!supportData.email || !supportData.message) {
      toast.error('Please fill in both email and message');
      return;
    }
    setLoading(true);
    try {
      // Using createComplaint for support/feedback
      await apiService.createComplaint({
        subject: 'Support Request from Footer',
        description: `Email: ${supportData.email}\nMessage: ${supportData.message}`,
        category: 'Support'
      });
      setSubmitted(true);
      toast.success('Support request sent! We will contact you soon.');
      setSupportData({ email: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      toast.error('Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
        
        {/* Brand & Social */}
        <div className="space-y-6">
          <div>
            <Link to="/" className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-primary-400">⚡</span> ServiceHub
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Your one-stop destination for reliable home services. Background-verified experts delivered to your doorstep.
            </p>
          </div>
          <div className="flex gap-4">
            {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary-600 hover:text-white transition-all">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {/* Dynamic Sections */}
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">{section.title}</h4>
            <ul className="space-y-3">
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="hover:text-primary-400 transition-colors text-sm flex items-center gap-2">
                    <ChevronRight size={14} className="text-slate-600" /> {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Support Form */}
        <div>
          <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Email Support</h4>
          <form onSubmit={handleSupportSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-slate-500" size={16} />
              <input
                type="email"
                required
                placeholder="Your email address"
                value={supportData.email}
                onChange={e => setSupportData({ ...supportData, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>
            <textarea
              required
              placeholder="How can we help?"
              rows={3}
              value={supportData.message}
              onChange={e => setSupportData({ ...supportData, message: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
            />
            <button
              type="submit"
              disabled={loading || submitted}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                submitted 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-900/20'
              }`}
            >
              {loading ? <Loader className="animate-spin" size={16} /> : submitted ? <CheckCircle2 size={16} /> : <Send size={16} />}
              {loading ? 'Sending...' : submitted ? 'Message Sent!' : 'Send Message'}
            </button>
          </form>
        </div>

      </div>

      {/* Trust Badges & Contact */}
      <div className="max-w-7xl mx-auto border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex gap-8 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" /> Verified Pros
          </div>
          <div className="flex items-center gap-2">
            <Info size={16} className="text-primary-500" /> 24/7 Support
          </div>
        </div>
        <div className="flex gap-4">
           <img src="/app_store.png" alt="App Store" className="h-8 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer" onError={e => e.target.style.display='none'} />
           <img src="/play_store.png" alt="Play Store" className="h-8 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer" onError={e => e.target.style.display='none'} />
        </div>
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} ServiceHub. All rights reserved.
        </p>
      </div>

      <style>{`
        footer a { opacity: 0.8; }
        footer a:hover { opacity: 1; }
      `}</style>
    </footer>
  );
}

function ChevronRight({ size, className }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
