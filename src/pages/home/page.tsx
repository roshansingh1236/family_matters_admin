import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Badge from '../../components/base/Badge';
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
        // Fetch Parents
        const { data: parentsData, error: pError } = await supabase
          .from('users')
          .select('*')
          .in('role', ['Intended Parent', 'intendedParent'])
          .order('updated_at', { ascending: false });

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

        // Fetch Surrogates
        const { data: surrogatesData, error: sError } = await supabase
          .from('users')
          .select('*')
          .in('role', ['Surrogate', 'gestationalCarrier'])
          .order('updated_at', { ascending: false });

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
    return formatMMDDYYYY(value);
  };

  const recentRequests = useMemo(() => {
    return [...parents]
      .sort((a, b) => {
        const aDate = parseTimestamp(a.data.updatedAt) ?? parseTimestamp(a.data.createdAt) ?? new Date(0);
        const bDate = parseTimestamp(b.data.updatedAt) ?? parseTimestamp(b.data.createdAt) ?? new Date(0);
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 5)
      .map(({ id, data }) => {
        const parent1Name = (data.parent1 as Record<string, unknown> | undefined)?.name as string | undefined;
        const formNameParts = [
          (data.formData as Record<string, unknown> | undefined)?.firstName,
          (data.formData as Record<string, unknown> | undefined)?.lastName
        ].filter(Boolean) as string[];
        const formName = formNameParts.join(' ');
        const formNameValue = formName.length > 0 ? formName : undefined;
        const fallbackFirstName = data.firstName as string | undefined;
        const fallbackEmail = data.email as string | undefined;

        const name =
          parent1Name ??
          formNameValue ??
          fallbackFirstName ??
          fallbackEmail ??
          'Intended Parent';

        const profileCompleted = Boolean(data.profileCompleted);
        const form2Completed = Boolean(data.form2Completed);

        let status: 'new' | 'profile' | 'form2' = 'new';
        if (form2Completed) status = 'form2';
        else if (profileCompleted) status = 'profile';

        const badgeConfig: Record<typeof status, { label: string; color: Parameters<typeof Badge>[0]['color'] }> = {
          new: { label: 'New', color: 'yellow' },
          profile: { label: 'Profile Complete', color: 'blue' },
          form2: { label: 'Form 2 Complete', color: 'green' }
        };

        const requestDate = parseTimestamp(data.updatedAt) ?? parseTimestamp(data.createdAt);

        return {
          id,
          name,
          statusConfig: badgeConfig[status],
          dateLabel: formatDate(requestDate),
          timeline: (data.formData as Record<string, unknown> | undefined)?.whenToStart as string | undefined,
          location: [
            (data.formData as Record<string, unknown> | undefined)?.city,
            (data.formData as Record<string, unknown> | undefined)?.state
          ]
            .filter(Boolean)
            .join(', ')
        };
      });
  }, [parents]);

  const topStats = useMemo(() => {
    const totalParents = parents.length;
    const totalSurrogates = surrogates.length;
    const parentProfilesComplete = parents.filter((parent) => parent.data.profileCompleted).length;
    const surrogateProfilesComplete = surrogates.filter((surrogate) => surrogate.data.profileCompleted).length;


    const ratioText = (complete: number, total: number) =>
      total === 0 ? '0 of 0' : `${complete} of ${total} • ${Math.round((complete / total) * 100)}%`;

    const onlineInquiries = inquiries.filter(i => i.data.source === 'online').length;
    const phoneInquiries = inquiries.filter(i => i.data.source === 'phone').length;

    return [
      {
        id: 'online-inquiries',
        label: 'Online Inquiries',
        value: onlineInquiries,
        subText: 'Real-time',
        icon: 'ri-global-line',
        colorClass: 'bg-indigo-100 text-indigo-600'
      },
      {
        id: 'phone-inquiries',
        label: 'Phone Inquiries',
        value: phoneInquiries,
        subText: 'Real-time',
        icon: 'ri-phone-line',
        colorClass: 'bg-pink-100 text-pink-600'
      },
      {
        id: 'parents-total',
        label: 'Intended Parents',
        value: totalParents,
        subText: ratioText(parentProfilesComplete, totalParents) + ' profiles ready',
        icon: 'ri-parent-line',
        colorClass: 'bg-blue-100 text-blue-600'
      },
      {
        id: 'surrogates-total',
        label: 'Surrogates',
        value: totalSurrogates,
        subText: ratioText(surrogateProfilesComplete, totalSurrogates) + ' profiles ready',
        icon: 'ri-user-heart-line',
        colorClass: 'bg-rose-100 text-rose-600'
      }
    ];
  }, [parents, surrogates, inquiries]);

  const handleViewRequestDetails = (requestId: string) => {
    navigate(`/parents/${requestId}`);
  };

  const getInitials = (name: string) =>
    name.split(' ').filter(Boolean).map(p => p[0]?.toUpperCase()).join('').slice(0, 2) || '?';

  const statGradients = [
    'from-violet-500 to-indigo-600',
    'from-pink-500 to-rose-600',
    'from-blue-500 to-cyan-600',
    'from-rose-500 to-pink-600',
  ];

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          {/* Hero banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 px-8 py-8">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),_transparent_60%)]" />
            <div className="absolute -bottom-8 -right-8 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute top-0 left-1/3 w-64 h-32 rounded-full bg-white/5 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <i className="ri-heart-line text-white/70 text-sm"></i>
                <p className="text-white/70 text-sm font-medium">Family Matters · Surrogacy Admin</p>
              </div>
              <h1 className="text-2xl font-bold text-white">Welcome back 👋</h1>
              <p className="text-white/70 text-sm mt-1">Here's what's happening with your surrogacy program today.</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {topStats.map((stat, i) => (
                <div
                  key={stat.id}
                  className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#15111f] border border-rose-100/60 dark:border-white/5 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${statGradients[i % statGradients.length]} opacity-[0.07] blur-xl`} />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2 leading-none">{stat.value}</p>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">{stat.subText}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${statGradients[i % statGradients.length]} flex items-center justify-center flex-shrink-0 shadow-md`}>
                      <i className={`${stat.icon} text-white text-base`}></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Requests */}
              <div className="lg:col-span-2 bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-rose-50 dark:border-white/5">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Recent Parent Requests</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Latest families joining the program</p>
                  </div>
                  <button
                    onClick={handleRequestClick}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
                  >
                    View all <i className="ri-arrow-right-line"></i>
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  {isParentsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-xl bg-rose-50/50 dark:bg-white/5 animate-pulse" />
                    ))
                  ) : parentsError ? (
                    <p className="text-sm text-red-500 p-2">{parentsError}</p>
                  ) : recentRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
                        <i className="ri-parent-line text-rose-400 text-xl"></i>
                      </div>
                      <p className="text-sm text-gray-400">No requests yet.</p>
                    </div>
                  ) : (
                    recentRequests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => handleViewRequestDetails(req.id)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50/70 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                          {getInitials(req.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{req.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {[req.timeline && `Timeline: ${req.timeline}`, req.location].filter(Boolean).join(' · ') || req.dateLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge color={req.statusConfig.color}>{req.statusConfig.label}</Badge>
                          <i className="ri-arrow-right-line text-gray-300 dark:text-gray-600 group-hover:text-rose-400 transition-colors text-sm"></i>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-rose-50 dark:border-white/5">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Quick Actions</h2>
                  </div>
                  <div className="p-3 space-y-1">
                    {[
                      { icon: 'ri-add-circle-line', label: 'New Application',  path: '/inquiries',    color: 'text-violet-500' },
                      { icon: 'ri-links-line',       label: 'Create a Match',   path: '/matches',      color: 'text-rose-500'   },
                      { icon: 'ri-calendar-add-line',label: 'Schedule Meeting', path: '/appointments', color: 'text-blue-500'   },
                      { icon: 'ri-file-chart-line',  label: 'Generate Report',  path: '/reports',      color: 'text-emerald-500'},
                    ].map(action => (
                      <button
                        key={action.path}
                        onClick={() => navigate(action.path)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-white/5 hover:text-rose-600 dark:hover:text-rose-400 transition-colors text-left"
                      >
                        <i className={`${action.icon} text-base ${action.color}`}></i>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upcoming placeholder */}
                <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-rose-50 dark:border-white/5">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Upcoming</h2>
                    <button onClick={handleAppointmentClick} className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors">
                      Calendar <i className="ri-arrow-right-line"></i>
                    </button>
                  </div>
                  <div className="px-5 py-8 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-calendar-event-line text-rose-400 text-lg"></i>
                    </div>
                    <p className="text-xs text-gray-400">No upcoming appointments</p>
                    <button onClick={handleAppointmentClick} className="mt-3 text-xs font-semibold text-rose-500 hover:underline">
                      Schedule one →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Snapshots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Parents Snapshot */}
              <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-rose-50 dark:border-white/5">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Intended Parents</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Latest families onboarding</p>
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

                <div className="p-3 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                  {isParentsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-rose-50/50 dark:bg-white/5 animate-pulse" />)
                  ) : parents.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No intended parents yet.</p>
                  ) : (
                    parents.slice(0, 8).map(({ id, data }) => {
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
              <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-rose-50 dark:border-white/5">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Surrogates</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Recent GCs in screening pipeline</p>
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

                <div className="p-3 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                  {isSurrogatesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-rose-50/50 dark:bg-white/5 animate-pulse" />)
                  ) : surrogates.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No surrogates yet.</p>
                  ) : (
                    surrogates.slice(0, 8).map(({ id, data }) => {
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
