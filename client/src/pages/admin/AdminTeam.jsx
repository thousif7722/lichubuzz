import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { UserPlus, Shield, Check, X, Loader, Users, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const PERMISSION_OPTS = [
  { id: 'manage_providers', label: 'KYC & Providers', desc: 'Approve docs, verify technicians' },
  { id: 'manage_bookings', label: 'Operations & Dispatch', desc: 'Monitor active jobs, reassign' },
  { id: 'manage_complaints', label: 'Customer Support', desc: 'Resolve disputes, handle reviews' },
  { id: 'manage_financials', label: 'Finance Team', desc: 'Refunds, wallet payouts, dues' },
  { id: 'manage_services', label: 'Catalog Team', desc: 'Add services, edit pricing & surge' },
  { id: 'manage_users', label: 'User Marketing', desc: 'Block users, handle subscriptions' },
];

export default function AdminTeam() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', permissions: [] });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchTeam();
  }, []);

  async function fetchTeam() {
    try {
      setLoading(true);
      const res = await apiService.getAdminTeam();
      setTeam(res.data.data);
    } catch (err) {
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  }

  function handleTogglePerm(permId) {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await apiService.updateTeamMember(editingId, { permissions: formData.permissions });
        toast.success('Permissions updated');
      } else {
        await apiService.createTeamMember(formData);
        toast.success('Team member added');
      }
      setShowModal(false);
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleBlock(id, currentStatus) {
    try {
      await apiService.updateTeamMember(id, { isBlocked: !currentStatus });
      toast.success(currentStatus ? 'Unblocked' : 'Blocked');
      fetchTeam();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  function openEdit(member) {
    setEditingId(member._id);
    setFormData({ name: member.name, phone: member.phone, email: member.email || '', permissions: member.permissions || [] });
    setShowModal(true);
  }

  function openNew() {
    setEditingId(null);
    setFormData({ name: '', phone: '', email: '', permissions: [] });
    setShowModal(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-primary-600" /> Team Management
            </h1>
            <p className="text-sm text-slate-500">Hire employees and assign them department permissions.</p>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <UserPlus size={18} /> Add Employee
          </button>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center"><Loader className="animate-spin text-primary-600" /></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Permissions</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-400">No team members hired yet.</td>
                    </tr>
                  ) : team.map(member => (
                    <tr key={member._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{member.name}</div>
                        <div className="text-xs text-slate-400">Joined {dayjs(member.createdAt).format('MMM D, YYYY')}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {member.phone}<br/>
                        <span className="text-xs text-slate-400">{member.email || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                          {member.permissions?.length > 0 ? member.permissions.map(p => (
                            <span key={p} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                              {p.replace('manage_', '').toUpperCase()}
                            </span>
                          )) : <span className="text-xs text-slate-400">No access</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${member.isBlocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {member.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(member)} className="text-primary-600 hover:text-primary-800 font-medium">Edit</button>
                          <button onClick={() => toggleBlock(member._id, member.isBlocked)} className="text-slate-400 hover:text-slate-600">
                            {member.isBlocked ? 'Unblock' : 'Block'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Permissions' : 'Hire Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="team-form" onSubmit={handleSubmit} className="space-y-5">
                {!editingId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" placeholder="John Doe" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone (10 digits)</label>
                        <input required type="tel" pattern="[6-9][0-9]{9}" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" placeholder="9876543210" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field" placeholder="john@startup.com" />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-primary-600"/> Assign Departments (Permissions)
                  </label>
                  <div className="space-y-3">
                    {PERMISSION_OPTS.map(opt => {
                      const isSelected = formData.permissions.includes(opt.id);
                      return (
                        <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={isSelected} 
                            onChange={() => handleTogglePerm(opt.id)} 
                          />
                          <div className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center shrink-0 border ${isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 bg-white'}`}>
                            {isSelected && <Check size={14} />}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isSelected ? 'text-primary-900' : 'text-slate-700'}`}>{opt.label}</p>
                            <p className="text-xs text-slate-500">{opt.desc}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
              <button form="team-form" type="submit" disabled={submitting} className="btn-primary px-8 flex items-center gap-2">
                {submitting ? <Loader className="animate-spin" size={18} /> : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
