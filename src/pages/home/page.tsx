import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { dashboardData } from '../../mocks/dashboardData';
import { db } from '../../lib/firebase';
import DataSection from '../../components/data/DataSection';

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
    navigate('/requests');
  };

  const handleAppointmentClick = () => {
    navigate('/appointments');
  };

  useEffect(() => {
    const parentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'Intended Parent'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      parentsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data() as Record<string, unknown>
        }));
        setParents(data);
        setIsParentsLoading(false);
        setParentsError(null);
      },
      (error) => {
        console.error('Failed to load parents for dashboard', error);
        setParents([]);
        setParentsError('Unable to load intended parent updates.');
        setIsParentsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const surrogatesQuery = query(
      collection(db, 'users'),
      where('role', '==', 'Surrogate'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      surrogatesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data() as Record<string, unknown>
        }));
        setSurrogates(data);
        setIsSurrogatesLoading(false);
        setSurrogatesError(null);
      },
      (error) => {
        console.error('Failed to load surrogates for dashboard', error);
        setSurrogates([]);
        setSurrogatesError('Unable to load surrogate updates.');
        setIsSurrogatesLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch users as inquiries for dashboard stats (aligning with RequestsPage logic)
    const inquiriesQuery = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      inquiriesQuery,
      (snapshot) => {
         const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            data: {
              ...docData,
              // Default to 'online' if source is missing, matching RequestsPage logic
              source: docData.source || 'online'
            }
          };
        });
        setInquiries(data);
      },
      (error) => {
        console.error('Failed to load inquiries for dashboard', error);
      }
    );
    return () => unsubscribe();
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
    return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening with your surrogacy program.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {topStats.map((stat) => (
              <Card key={stat.id} className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{stat.subText}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.colorClass}`}>
                    <i className={`${stat.icon} text-lg`}></i>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Requests */}
            <div className="lg:col-span-2">
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Requests</h2>
                  <Button variant="outline" size="sm" onClick={handleRequestClick}>
                    <i className="ri-arrow-right-line mr-1"></i>
                    View All
                  </Button>
                </div>
                {isParentsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-16 w-full rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    ))}
                  </div>
                ) : parentsError ? (
                  <p className="text-sm text-red-500 dark:text-red-400">{parentsError}</p>
                ) : recentRequests.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent requests yet.</p>
                ) : (
                  <div className="space-y-4">
                    {recentRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                        onClick={() => handleViewRequestDetails(request.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <i className="ri-user-line text-blue-600 dark:text-blue-400"></i>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">{request.name}</h3>
                            <p className="text-xs uppercase text-gray-500 dark:text-gray-400 mt-0.5">{request.dateLabel}</p>
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              {request.timeline && <p>Timeline: {request.timeline}</p>}
                              {request.location && <p>Location: {request.location}</p>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge color={request.statusConfig.color}>{request.statusConfig.label}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleViewRequestDetails(request.id);
                            }}
                          >
                            <i className="ri-eye-line mr-1"></i>
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Quick Actions & Upcoming */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/requests')}>
                    <i className="ri-add-line mr-2"></i>
                    New Application
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/matches')}>
                    <i className="ri-links-line mr-2"></i>
                    Create Match
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/appointments')}>
                    <i className="ri-calendar-line mr-2"></i>
                    Schedule Meeting
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/reports')}>
                    <i className="ri-file-text-line mr-2"></i>
                    Generate Report
                  </Button>
                </div>
              </Card>

              {/* Upcoming Appointments */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upcoming</h2>
                  <Button variant="outline" size="sm" onClick={handleAppointmentClick}>
                    <i className="ri-calendar-line mr-1"></i>
                    Calendar
                  </Button>
                </div>
                <div className="space-y-3">
                  {dashboardData.upcomingAppointments.map((appointment) => (
                    <div 
                      key={appointment.id} 
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                      onClick={handleAppointmentClick}
                    >
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">{appointment.title}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{appointment.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Recent Medical Records */}
          <div className="mt-8">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Medical Records</h2>
                <Button variant="outline" size="sm" onClick={handleMedicalRecordClick}>
                  <i className="ri-arrow-right-line mr-1"></i>
                  View All
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.recentMedicalRecords.map((record) => (
                  <div 
                    key={record.id} 
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={handleMedicalRecordClick}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                          <i className="ri-search-line text-lg"></i>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{record.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <i className="ri-user-heart-line text-xs"></i>
                            <span>{record.patient}</span>
                            <span>•</span>
                            <span>{record.date}</span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{record.doctor} • {record.facility}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge color={record.status === 'completed' ? 'green' : record.status === 'pending' ? 'yellow' : 'blue'}>
                          {record.status}
                        </Badge>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{record.attachments} attachments</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Live Profiles */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Intended Parents Snapshot</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Latest families onboarding to Family Matters.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/parents')}>
                  <i className="ri-parent-line mr-1"></i>
                  View All
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {parentsStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{stat.label}</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              {isParentsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-20 w-full rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  ))}
                </div>
              ) : parentsError ? (
                <p className="text-sm text-red-500 dark:text-red-400">{parentsError}</p>
              ) : parents.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No intended parents found.</p>
              ) : (
                <div className="space-y-4">
                  {parents.map(({ id, data }) => (
                    <div
                      key={id}
                      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      onClick={() => navigate(`/parents/${id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            {(data.firstName as string | undefined) ?? (data.email as string | undefined) ?? 'Intended Parent'}
                          </h3>
                          <p className="text-xs uppercase text-gray-500 dark:text-gray-400 mt-1">ID: {id}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge color={data.profileCompleted ? 'green' : 'yellow'}>
                            {data.profileCompleted ? 'Profile Complete' : 'Profile Pending'}
                          </Badge>
                          <Badge color={data.form2Completed ? 'blue' : 'gray'}>
                            {data.form2Completed ? 'Form 2 Complete' : 'Form 2 Pending'}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        <DataSection
                          title=""
                          data={{
                            'When To Start': (data.formData as Record<string, unknown> | undefined)?.whenToStart,
                            Location: [
                              (data.formData as Record<string, unknown> | undefined)?.city,
                              (data.formData as Record<string, unknown> | undefined)?.state
                            ]
                              .filter(Boolean)
                              .join(', ')
                          }}
                          emptyMessage="No journey details yet."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Surrogate Snapshot</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Recent surrogates progressing through screening.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/surrogates')}>
                  <i className="ri-user-heart-line mr-1"></i>
                  View All
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {surrogateStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{stat.label}</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              {isSurrogatesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-20 w-full rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  ))}
                </div>
              ) : surrogatesError ? (
                <p className="text-sm text-red-500 dark:text-red-400">{surrogatesError}</p>
              ) : surrogates.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No surrogates found.</p>
              ) : (
                <div className="space-y-4">
                  {surrogates.map(({ id, data }) => (
                    <div
                      key={id}
                      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      onClick={() => navigate(`/surrogates/${id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            {(data.firstName as string | undefined) ?? (data.email as string | undefined) ?? 'Surrogate'}
                          </h3>
                          <p className="text-xs uppercase text-gray-500 dark:text-gray-400 mt-1">ID: {id}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge color={data.profileCompleted ? 'green' : 'yellow'}>
                            {data.profileCompleted ? 'Profile Complete' : 'Profile Pending'}
                          </Badge>
                          <Badge color={data.form2Completed ? 'blue' : 'gray'}>
                            {data.form2Completed ? 'Form 2 Complete' : 'Form 2 Pending'}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        <DataSection
                          title=""
                          data={{
                            Availability: (data.form2 as Record<string, unknown> | undefined)?.availability,
                            Location: [
                              (data.formData as Record<string, unknown> | undefined)?.city,
                              (data.formData as Record<string, unknown> | undefined)?.state
                            ]
                              .filter(Boolean)
                              .join(', ')
                          }}
                          emptyMessage="No readiness details yet."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;
