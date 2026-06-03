import React, { useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Megaphone, Send, Users, Activity, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminAnnouncements() {
  const [formData, setFormData] = useState({ title: '', body: '', targetRole: '' });
  const [loading, setLoading] = useState(false);
  const [sentBroadcasts, setSentBroadcasts] = useState([]);

  async function handleBroadcast(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiService.broadcastAnnouncement(formData);
      toast.success('Announcement broadcasted!');
      setSentBroadcasts([{ ...res.data.data, createdAt: new Date() }, ...sentBroadcasts]);
      setFormData({ title: '', body: '', targetRole: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-20 max-w-5xl mx-auto px-4 sm:px-6">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="text-indigo-600" /> Internal Announcements
          </h1>
          <p className="text-sm text-slate-500 mt-1">Broadcast urgent updates, policy changes, or push notifications to your teams.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          
          {/* Composer */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Send size={18} className="text-slate-400" /> Compose Broadcast
              </h2>
              
              <form onSubmit={handleBroadcast} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
                  <select 
                    required 
                    value={formData.targetRole} 
                    onChange={e => setFormData({...formData, targetRole: e.target.value})} 
                    className="input-field"
                  >
                    <option value="">Select Audience...</option>
                    <option value="all">All Users (Everyone)</option>
                    <option value="technician">All Technicians (Providers)</option>
                    <option value="customer">All Customers</option>
                    <option value="staff">Internal Team (Staff/Managers)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Announcement Title</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                    className="input-field" 
                    placeholder="e.g. Diwali Bonus Structure Update" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message Body</label>
                  <textarea 
                    required 
                    rows="5"
                    value={formData.body} 
                    onChange={e => setFormData({...formData, body: e.target.value})} 
                    className="input-field resize-none" 
                    placeholder="Type your message here..." 
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={loading} className="btn-primary w-full flex justify-center items-center gap-2 py-3 text-base">
                    {loading ? <Activity className="animate-spin" size={20} /> : <Megaphone size={20} />}
                    {loading ? 'Broadcasting...' : 'Send Broadcast Now'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Recent Broadcasts */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full">
              <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" /> Recent Broadcasts
              </h2>
              
              <div className="space-y-4">
                {sentBroadcasts.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    No broadcasts sent during this session.
                  </div>
                ) : (
                  sentBroadcasts.map((b, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700">
                          Target: {b.referenceType}
                        </span>
                        <span className="text-[10px] text-slate-400">Just now</span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mb-1">{b.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{b.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
