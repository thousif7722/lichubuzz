import React, { useState } from 'react';
import Header from '@/components/common/Header';
import { apiService } from '@/services/api';
import toast from 'react-hot-toast';
import { Briefcase, Send, MapPin, Loader } from 'lucide-react';

export default function Careers() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    roleApplied: 'technician',
    city: '',
    experienceLevel: 'Fresher',
    skills: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean)
      };
      await apiService.applyForJob(payload);
      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-24 max-w-3xl mx-auto px-4">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
            <Briefcase size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Join Our Team</h1>
          <p className="text-slate-500">We are always looking for talented technicians, interns, and leaders.</p>
        </div>

        {submitted ? (
          <div className="bg-white p-10 rounded-3xl shadow-sm text-center border border-slate-100">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5">
              <Send size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Received!</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Thank you for applying. Our hiring team will review your application and contact you on your registered phone number shortly.
            </p>
          </div>
        ) : (
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-slate-200">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input required type="tel" pattern="[0-9]{10}" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" placeholder="10-digit mobile number" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address (Optional)</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input required type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="input-field pl-9" placeholder="e.g. Bangalore" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role Applied For</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'technician', label: 'Technician' },
                    { id: 'intern', label: 'Intern' },
                    { id: 'team_leader', label: 'Team Leader' },
                    { id: 'manager', label: 'Manager' },
                  ].map(role => (
                    <label key={role.id} className={`p-3 text-center rounded-xl border-2 cursor-pointer transition-all ${formData.roleApplied === role.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'}`}>
                      <input type="radio" className="hidden" name="roleApplied" value={role.id} checked={formData.roleApplied === role.id} onChange={e => setFormData({...formData, roleApplied: e.target.value})} />
                      <span className="text-sm font-bold">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Experience Level</label>
                  <select value={formData.experienceLevel} onChange={e => setFormData({...formData, experienceLevel: e.target.value})} className="input-field">
                    <option value="Fresher">Fresher (0 years)</option>
                    <option value="1-3 years">1-3 years</option>
                    <option value="3-5 years">3-5 years</option>
                    <option value="5+ years">5+ years</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Key Skills</label>
                  <input type="text" value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} className="input-field" placeholder="Plumbing, AC Repair, Management..." />
                  <p className="text-xs text-slate-400 mt-1">Comma separated</p>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base font-bold flex justify-center items-center gap-2 mt-8">
                {loading ? <Loader className="animate-spin" size={20} /> : <Send size={20} />}
                {loading ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
