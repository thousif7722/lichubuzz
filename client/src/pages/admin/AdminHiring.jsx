import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Briefcase, UserCheck, Calendar, MapPin, Search, Plus, Play, UserPlus, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const STAGES = ['applied', 'screening', 'interview', 'selected', 'onboarded', 'rejected'];
const ROLE_COLORS = {
  intern: 'bg-teal-100 text-teal-700',
  technician: 'bg-blue-100 text-blue-700',
  team_leader: 'bg-purple-100 text-purple-700',
  manager: 'bg-amber-100 text-amber-700',
};

export default function AdminHiring() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchCandidates();
  }, [roleFilter]);

  async function fetchCandidates() {
    setLoading(true);
    try {
      const res = await apiService.getCandidates({ role: roleFilter || undefined });
      setCandidates(res.data.data);
    } catch (err) {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }

  async function moveStage(id, newStatus) {
    try {
      await apiService.updateCandidateStatus(id, { status: newStatus });
      toast.success(`Moved to ${newStatus}`);
      fetchCandidates();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function handleOnboard(id) {
    try {
      await apiService.onboardCandidate(id);
      toast.success('Successfully onboarded! Account created.');
      fetchCandidates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to onboard');
    }
  }

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-20 px-4 sm:px-6 w-full max-w-[1600px] mx-auto h-[calc(100vh-80px)] flex flex-col">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="text-primary-600" /> Recruitment Pipeline
            </h1>
            <p className="text-sm text-slate-500">Manage incoming applications and onboard new team members.</p>
          </div>
          
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates..." className="input-field pl-9 py-2 text-sm w-48" />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input-field py-2 text-sm">
              <option value="">All Roles</option>
              <option value="technician">Technician</option>
              <option value="intern">Intern</option>
              <option value="team_leader">Team Leader</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary-600" /></div>
        ) : (
          <div className="flex-1 flex gap-4 overflow-x-auto pb-4 custom-scrollbar items-start">
            {STAGES.map(stage => {
              const columnCandidates = filteredCandidates.filter(c => c.status === stage);
              
              return (
                <div key={stage} className="bg-slate-100/50 rounded-2xl w-80 shrink-0 flex flex-col max-h-full border border-slate-200">
                  <div className="p-4 border-b border-slate-200/50 flex justify-between items-center bg-slate-100/80 rounded-t-2xl shrink-0">
                    <h3 className="font-bold text-slate-700 capitalize flex items-center gap-2">
                      {stage} <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{columnCandidates.length}</span>
                    </h3>
                  </div>
                  
                  <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                    {columnCandidates.map(candidate => (
                      <div key={candidate._id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-800 leading-tight">{candidate.name}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${ROLE_COLORS[candidate.roleApplied] || 'bg-slate-100'}`}>
                            {candidate.roleApplied.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="space-y-1.5 mb-4">
                          <p className="text-xs text-slate-500 flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" /> {candidate.city || 'Bangalore'}</p>
                          <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">📞 {candidate.phone}</p>
                          {candidate.experienceLevel && <p className="text-xs text-slate-500 flex items-center gap-1.5">💼 {candidate.experienceLevel} exp.</p>}
                        </div>

                        {/* Pipeline Actions */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-50">
                          {stage === 'applied' && (
                            <button onClick={() => moveStage(candidate._id, 'screening')} className="text-xs bg-slate-50 text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 font-medium flex-1">Screen</button>
                          )}
                          {stage === 'screening' && (
                            <button onClick={() => moveStage(candidate._id, 'interview')} className="text-xs bg-slate-50 text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-amber-50 hover:text-amber-600 font-medium flex-1">Schedule Int.</button>
                          )}
                          {stage === 'interview' && (
                            <button onClick={() => moveStage(candidate._id, 'selected')} className="text-xs bg-slate-50 text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-green-50 hover:text-green-600 font-medium flex-1">Select</button>
                          )}
                          {stage === 'selected' && (
                            <button onClick={() => handleOnboard(candidate._id)} className="text-xs bg-primary-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-primary-700 font-medium flex-1 flex justify-center items-center gap-1">
                              <UserPlus size={12} /> Onboard Now
                            </button>
                          )}
                          
                          {/* Reject Option */}
                          {['applied', 'screening', 'interview'].includes(stage) && (
                            <button onClick={() => moveStage(candidate._id, 'rejected')} className="text-xs text-slate-400 hover:text-red-500 font-medium px-2 py-1.5">Reject</button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {columnCandidates.length === 0 && (
                      <div className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium">
                        Drop zone empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
