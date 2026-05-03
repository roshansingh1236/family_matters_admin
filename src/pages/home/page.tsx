import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Badge from '../../components/base/Badge';
import Card from '../../components/base/Card';
import { formatMMDDYYYY } from '../../utils/dateFormat';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [parents, setParents] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [surrogates, setSurrogates] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [inquiries, setInquiries] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [isParentsLoading, setIsParentsLoading] = useState(true);
  const [isSurrogatesLoading, setIsSurrogatesLoading] = useState(true);
  const [parentsError, setParentsError] = useState<string | null>(null);
  const [surrogatesError, setSurrogatesError] = useState<string | null>(null);

  const handleMedicalRecordClick = () => {
    navigate('/medical');
  };

  const handleRequestClick = () => {
    navigate('/inquiries');
  };

  const handleAppointmentClick = () => {
    navigate('/appointments');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Parents (Latest first by created_at)
        const { data: parentsData, error: pError } = await supabase
          .from('users')
          .select('*')
          .in('role', ['Intended Parent', 'intendedParent'])
          .order('created_at', { ascending: false });

        if (pError) throw pError;
        setParents((parentsData || []).map(u => ({
            id: u.id,
            data: {
                ...u,
                firstName: u.full_name?.split(' ')[0],
                lastName: u.full_name?.split(' ').slice(1).join(' '),
                profileCompleted: u.profile_completed,
                form2Completed: u.form_2_completed ?? u.form2_completed ?? false,
                formData: u.form_data,
                updatedAt: u.updated_at,
                createdAt: u.created_at
            }
        })));
        setIsParentsLoading(false);

        // Fetch Surrogates (Latest first by created_at)
        const { data: surrogatesData, error: sError } = await supabase
          .from('users')
          .select('*')
          .in('role', ['Surrogate', 'gestationalCarrier'])
          .order('created_at', { ascending: false });

        if (sError) throw sError;
        setSurrogates((surrogatesData || []).map(u => ({
            id: u.id,
            data: {
                ...u,
                firstName: u.full_name?.split(' ')[0],
                lastName: u.full_name?.split(' ').slice(1).join(' '),
                profileCompleted: u.profile_completed,
                form2Completed: u.form_2_completed ?? u.form2_completed ?? false,
                formData: u.form_data,
                updatedAt: u.updated_at,
                createdAt: u.created_at
            }
        })));
        setIsSurrogatesLoading(false);

        // Fetch Inquiries
        const { data: inquiriesData, error: iError } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (iError) throw iError;
        setInquiries((inquiriesData || []).map(u => ({
            id: u.id,
            data: {
                ...u,
                source: u.source || 'online'
            }
        })));

      } catch (error: any) {
        console.error('Failed to load dashboard data', error);
        setParentsError('Unable to load dashboard updates.');
        setIsParentsLoading(false);
        setIsSurrogatesLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const parentsStats = useMemo(() => {
    const total = parents.length;
    const profileCompleted = parents.filter((parent) => parent.data.profileCompleted).length;
    const form2Completed = parents.filter((parent) => parent.data.form2Completed).length;
    return [
      { label: 'Tracked Parents', value: total },
      { label: 'Profiles Complete', value: profileCompleted },
      { label: 'Form 2 Complete', value: form2Completed }
    ];
  }, [parents]);

  const surrogateStats = useMemo(() => {
    const total = surrogates.length;
    const profileCompleted = surrogates.filter((surrogate) => surrogate.data.profileCompleted).length;
    const form2Completed = surrogates.filter((surrogate) => surrogate.data.form2Completed).length;
    return [
      { label: 'Tracked Surrogates', value: total },
      { label: 'Profiles Complete', value: profileCompleted },
      { label: 'Form 2 Complete', value: form2Completed }
    ];
  }, [surrogates]);

  const parseTimestamp = (value: unknown): Date | null => {
    if (!value) return null;
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (value: Date | null) => {
    if (!value) return '—';
    return value.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0].toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0e0b1a] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Admin Dashboard</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">Global activity overview and operational insights.</p>
              </div>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-white dark:bg-white/5 border border-rose-100/50 dark:border-white/10 px-4 py-2.5 rounded-xl">
                   <i className="ri-calendar-line text-rose-500"></i>
                   {formatMMDDYYYY(new Date().toISOString())}
                 </div>
              </div>
            </div>

            {/* Top Stats Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card className="bg-gradient-to-br from-rose-500 to-rose-600 border-none p-6 shadow-lg shadow-rose-500/20 group relative overflow-hidden cursor-pointer" onClick={handleRequestClick}>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i className="ri-question-answer-line text-8xl text-white"></i>
                  </div>
                  <div className="relative z-10 text-white">
                    <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Total Inquiries</p>
                    <p className="text-4xl font-black mb-4">{inquiries.length}</p>
                    <div className="flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-3 py-1.5 rounded-full">
                       Manage Leads <i className="ri-arrow-right-line"></i>
                    </div>
                  </div>
               </Card>

               <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 border-none p-6 shadow-lg shadow-blue-500/20 group relative overflow-hidden cursor-pointer" onClick={handleAppointmentClick}>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i className="ri-calendar-event-line text-8xl text-white"></i>
                  </div>
                  <div className="relative z-10 text-white">
                    <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Screening Appointments</p>
                    <p className="text-4xl font-black mb-4">12</p>
                    <div className="flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-3 py-1.5 rounded-full">
                       View Calendar <i className="ri-arrow-right-line"></i>
                    </div>
                  </div>
               </Card>

               <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-none p-6 shadow-lg shadow-emerald-500/20 group relative overflow-hidden cursor-pointer" onClick={handleMedicalRecordClick}>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i className="ri-heart-pulse-line text-8xl text-white"></i>
                  </div>
                  <div className="relative z-10 text-white">
                    <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Medical Records</p>
                    <p className="text-4xl font-black mb-4">08</p>
                    <div className="flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-3 py-1.5 rounded-full">
                       Pending Review <i className="ri-arrow-right-line"></i>
                    </div>
                  </div>
               </Card>
            </div>

            {/* Profile Snapshots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Parents Snapshot */}
              <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-rose-50 dark:border-white/5">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Intended Parents</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Most recent inquiries first</p>
                  </div>
                  <button onClick={() => navigate('/parents')} className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors">
                    View all <i className="ri-arrow-right-line"></i>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 p-4 border-b border-rose-50/60 dark:border-white/5">
                  {parentsStats.map((stat, i) => {
                    const colors = ['bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400', 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', 'bg-blue-50 dark:bg-blue-500/10 text-rose-500 dark:text-rose-400'];
                    return (
                      <div key={stat.label} className={`rounded-xl p-3 ${colors[i]}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-tight">{stat.label}</p>
                        <p className="text-xl font-bold mt-1">{stat.value}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 space-y-1 max-h-80 overflow-y-auto custom-scrollbar flex-1">
                  {isParentsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-rose-50/50 dark:bg-white/5 animate-pulse" />)
                  ) : parents.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No intended parents yet.</p>
                  ) : (
                    parents.slice(0, 10).map(({ id, data }) => {
                      const name = (data.firstName as string | undefined) ?? (data.email as string | undefined) ?? 'Intended Parent';
                      return (
                        <div key={id} onClick={() => navigate(`/parents/${id}`)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50/70 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {getInitials(name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{name}</p>
                            <p className="text-[10px] text-gray-400">
                              {[(data.formData as any)?.city, (data.formData as any)?.state].filter(Boolean).join(', ') || 'Location not set'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {data.profileCompleted && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Profile complete"></span>}
                            {data.form2Completed   && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"    title="Form 2 complete"></span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Surrogates Snapshot */}
              <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-rose-50 dark:border-white/5">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Surrogates</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Most recent inquiries first</p>
                  </div>
                  <button onClick={() => navigate('/surrogates')} className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors">
                    View all <i className="ri-arrow-right-line"></i>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 p-4 border-b border-rose-50/60 dark:border-white/5">
                  {surrogateStats.map((stat, i) => {
                    const colors = ['bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400', 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'];
                    return (
                      <div key={stat.label} className={`rounded-xl p-3 ${colors[i]}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-tight">{stat.label}</p>
                        <p className="text-xl font-bold mt-1">{stat.value}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 space-y-1 max-h-80 overflow-y-auto custom-scrollbar flex-1">
                  {isSurrogatesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-rose-50/50 dark:bg-white/5 animate-pulse" />)
                  ) : surrogates.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No surrogates yet.</p>
                  ) : (
                    surrogates.slice(0, 10).map(({ id, data }) => {
                      const name = (data.firstName as string | undefined) ?? (data.email as string | undefined) ?? 'Surrogate';
                      return (
                        <div key={id} onClick={() => navigate(`/surrogates/${id}`)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50/70 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {getInitials(name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{name}</p>
                            <p className="text-[10px] text-gray-400">
                              {[(data.formData as any)?.city, (data.formData as any)?.state].filter(Boolean).join(', ') || 'Location not set'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {data.profileCompleted && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Profile complete"></span>}
                            {data.form2Completed   && <span className="w-1.5 h-1.5 rounded-full bg-purple-400"  title="Form 2 complete"></span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;
