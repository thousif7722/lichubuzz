import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { useSelector } from 'react-redux';
import { selectServices } from '@/store/slices/serviceSlice';
import Header from '@/components/common/Header';
import { Save, Upload, CreditCard, Star, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProviderProfile() {
  const allServices = useSelector(selectServices);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState('profile');
  const [form, setForm] = useState({ name: '', experience: '', serviceRadius: 10 });
  const [selectedServices, setSelectedServices] = useState([]);
  const [bank, setBank] = useState({ accountNumber: '', ifscCode: '', bankName: '', accountHolder: '' });
  const [kycFiles, setKycFiles] = useState({});

  useEffect(() => {
    apiService.getMyProfile().then(res => {
      const p = res.data.data;
      setProfile(p);
      setForm({ name: p.name, experience: p.experience, serviceRadius: p.serviceRadius || 10 });
      setSelectedServices(p.services?.map(s => s._id || s) || []);
    });
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      await apiService.updateProfile(form);
      toast.success('Profile updated');
    } catch { toast.error('Failed'); }
    setSaving(false);
  }

  async function saveServices() {
    setSaving(true);
    try {
      await apiService.updateServices(selectedServices);
      toast.success('Services updated');
    } catch { toast.error('Failed'); }
    setSaving(false);
  }

  async function saveBank() {
    setSaving(true);
    try {
      await apiService.updateBankAccount(bank);
      toast.success('Bank account saved');
    } catch { toast.error('Failed'); }
    setSaving(false);
  }

  async function uploadKYC() {
    if (!kycFiles.aadhaarDoc && !kycFiles.panDoc) return toast.error('Please upload documents');
    setSaving(true);
    try {
      const fd = new FormData();
      if (kycFiles.aadhaarDoc) fd.append('aadhaarDoc', kycFiles.aadhaarDoc);
      if (kycFiles.panDoc) fd.append('panDoc', kycFiles.panDoc);
      if (kycFiles.selfie) fd.append('selfie', kycFiles.selfie);
      await apiService.uploadKYC(fd);
      toast.success('KYC documents submitted for review');
    } catch { toast.error('Upload failed'); }
    setSaving(false);
  }

  const sections = [
    { id: 'profile', label: 'Profile', icon: Star },
    { id: 'services', label: 'My Services', icon: Shield },
    { id: 'kyc', label: 'KYC Documents', icon: Upload },
    { id: 'bank', label: 'Bank Account', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-5">Provider Profile</h1>

        {/* Status banner */}
        {profile && (
          <div className={`card p-4 mb-5 flex items-center gap-3 ${profile.approvalStatus === 'approved' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
            <span className="text-2xl">{profile.approvalStatus === 'approved' ? '✅' : '⏳'}</span>
            <div>
              <p className="font-semibold text-slate-800 capitalize">{profile.approvalStatus === 'approved' ? 'Account Verified' : 'Verification Pending'}</p>
              <p className="text-xs text-slate-500">
                {profile.approvalStatus === 'approved' ? `Tier: ${profile.tier} · ${profile.completedJobs} jobs` : 'Complete KYC to get approved faster'}
              </p>
            </div>
          </div>
        )}

        {/* Accordion sections */}
        <div className="space-y-3">
          {sections.map(({ id, label, icon: Icon }) => (
            <div key={id} className="card overflow-hidden">
              <button
                onClick={() => setSection(section === id ? null : id)}
                className="w-full flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-primary-600" />
                  <span className="font-semibold text-slate-800">{label}</span>
                </div>
                {section === id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </button>

              {section === id && (
                <div className="border-t border-slate-100 p-5">
                  {id === 'profile' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Years of Experience</label>
                        <input type="number" value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} className="input-field" min={0} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Service Radius (km)</label>
                        <input type="number" value={form.serviceRadius} onChange={e => setForm(f => ({ ...f, serviceRadius: e.target.value }))} className="input-field" min={1} max={50} />
                      </div>
                      <button onClick={saveProfile} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                        <Save size={16} /> {saving ? 'Saving…' : 'Save Profile'}
                      </button>
                    </div>
                  )}

                  {id === 'services' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Select the services you can provide:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {allServices.map(s => (
                          <label key={s._id} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedServices.includes(s._id) ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input
                              type="checkbox"
                              checked={selectedServices.includes(s._id)}
                              onChange={e => setSelectedServices(prev => e.target.checked ? [...prev, s._id] : prev.filter(id => id !== s._id))}
                              className="w-4 h-4 accent-primary-600"
                            />
                            <span className="text-sm font-medium text-slate-700 leading-tight">{s.icon} {s.name}</span>
                          </label>
                        ))}
                      </div>
                      <button onClick={saveServices} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                        <Save size={16} /> {saving ? 'Saving…' : 'Save Services'}
                      </button>
                    </div>
                  )}

                  {id === 'kyc' && (
                    <div className="space-y-4">
                      {profile?.kyc?.status === 'verified' ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                          <span className="text-2xl">✅</span>
                          <div>
                            <p className="font-semibold text-green-700">KYC Verified</p>
                            <p className="text-xs text-green-600">Your identity has been verified</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-500">Upload clear photos of your documents:</p>
                          {[
                            { key: 'aadhaarDoc', label: 'Aadhaar Card (Front & Back) *' },
                            { key: 'panDoc', label: 'PAN Card *' },
                            { key: 'selfie', label: 'Selfie with Aadhaar' },
                          ].map(({ key, label }) => (
                            <div key={key}>
                              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={e => setKycFiles(f => ({ ...f, [key]: e.target.files[0] }))}
                                className="input-field text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 file:text-xs file:font-medium"
                              />
                            </div>
                          ))}
                          <button onClick={uploadKYC} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                            <Upload size={16} /> {saving ? 'Uploading…' : 'Submit KYC Documents'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {id === 'bank' && (
                    <div className="space-y-4">
                      {[
                        { key: 'accountHolder', label: 'Account Holder Name', placeholder: 'Full name as per bank' },
                        { key: 'accountNumber', label: 'Account Number', placeholder: '12-digit account number' },
                        { key: 'ifscCode', label: 'IFSC Code', placeholder: 'SBIN0001234' },
                        { key: 'bankName', label: 'Bank Name', placeholder: 'State Bank of India' },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                          <input value={bank[key]} onChange={e => setBank(b => ({ ...b, [key]: e.target.value }))} placeholder={placeholder} className="input-field" />
                        </div>
                      ))}
                      <button onClick={saveBank} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                        <Save size={16} /> {saving ? 'Saving…' : 'Save Bank Account'}
                      </button>
                      <p className="text-xs text-slate-400 text-center">Bank account will be verified within 1–2 business days</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
