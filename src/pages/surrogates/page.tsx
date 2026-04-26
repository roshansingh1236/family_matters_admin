import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import DataSection from '../../components/data/DataSection';
import AddUserDialog from '../../components/feature/AddUserDialog';
import type { User, UserStatus } from '../../types';
import { GC_STATUSES } from '../../types';
import {
  resolveSurrogateAdditionalProfile,
  resolveSurrogateIntakeProfile
} from '../../utils/surrogateFormData';
import { formatMMDDYYYY } from '../../utils/dateFormat';

const statusDefinitions = [
  {
    id: 'all',
    label: 'All',
    filter: (_surrogate: User) => true
  },
  {
    id: 'new_application',
    label: 'New Application',
    filter: (surrogate: User) => surrogate.status === 'New Application'
  },
  {
    id: 'pre_screen',
    label: 'Pre-Screen',
    filter: (surrogate: User) => surrogate.status === 'Pre-Screen'
  },
  {
    id: 'screening',
    label: 'Screening',
    filter: (surrogate: User) => surrogate.status === 'Screening in Progress'
  },
  {
    id: 'accepted',
    label: 'Accepted',
    filter: (surrogate: User) => surrogate.status === 'Accepted to Program'
  },
  {
    id: 'on_hold',
    label: 'On Hold',
    filter: (surrogate: User) => surrogate.status === 'On Hold'
  },
  {
    id: 'declined',
    label: 'Declined',
    filter: (surrogate: User) => surrogate.status === 'Declined / Inactive'
  }
];

const SurrogatesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('table');
  const [selectedSurrogate, setSelectedSurrogate] = useState<User | null>(null);
  const [surrogates, setSurrogates] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const navigate = useNavigate();

  const fetchSurrogates = async () => {
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('*')
        .in('role', ['Surrogate', 'gestationalCarrier']);

      if (err) throw err;
      
      const mappedData: User[] = (data || []).map(u => {
        const fd = (u.form_data || u.formData || u.formdata || {}) as Record<string, unknown>;
        const intake = resolveSurrogateIntakeProfile(fd, u as Record<string, unknown>);
        const additional = resolveSurrogateAdditionalProfile(fd, u as Record<string, unknown>);
        return {
          id: u.id,
          ...u,
          profileCompleted: u.profile_completed || u.profileCompleted,
          form2Completed: u.form2_completed || u.form2Completed || u.form_2_completed,
          formData: fd,
          form2: u.form2,
          form2Data: u.form2_data || u.form2Data || u.form2data,
          surrogateProfile: intake,
          additionalProfile: additional,
          updatedAt: u.updated_at,
          createdAt: u.created_at
        };
      });
      
      setSurrogates(mappedData);
      setIsLoading(false);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load surrogates', err);
      setError('Unable to load surrogate records. Please try again later.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSurrogates();

    const channel = supabase
      .channel('public:users:surrogates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'users'
      }, (payload: any) => {
        if (payload.new && (payload.new.role === 'Surrogate' || payload.new.role === 'gestationalCarrier')) {
            fetchSurrogates();
        } else if (payload.old && (payload.old.role === 'Surrogate' || payload.old.role === 'gestationalCarrier')) {
            fetchSurrogates();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusUpdate = async (userId: string, newStatus: UserStatus) => {
    try {
      const { error: err } = await supabase
        .from('users')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (err) throw err;
      
      if (selectedSurrogate && selectedSurrogate.id === userId) {
        setSelectedSurrogate({ ...selectedSurrogate, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const statusCounts = useMemo(() => {
    return statusDefinitions.reduce<Record<string, number>>((acc, status) => {
      acc[status.id] = surrogates.filter((surrogate) => status.filter(surrogate)).length;
      return acc;
    }, {});
  }, [surrogates]);

  const filteredSurrogates = useMemo(() => {
    const currentStatus = statusDefinitions.find((status) => status.id === activeTab);
    let filtered = currentStatus ? surrogates.filter((surrogate) => currentStatus.filter(surrogate)) : surrogates;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(surrogate => {
        const name = getDisplayName(surrogate).toLowerCase();
        const email = (surrogate.email || '').toLowerCase();
        const phone = getPhone(surrogate).toLowerCase();
        const id = (surrogate.id || '').toLowerCase();
        return (
          name.includes(query) || 
          email.includes(query) || 
          phone.includes(query) || 
          id.includes(query)
        );
      });
    }

    return filtered;
  }, [activeTab, surrogates, searchQuery]);

  const getStatusBadge = (surrogate: User) => {
    const status = surrogate.status;
    switch (status) {
      case 'New Application': return <Badge color="blue">New App</Badge>;
      case 'Pre-Screen': return <Badge color="indigo">Pre-Screen</Badge>;
      case 'Screening in Progress': return <Badge color="purple">Screening</Badge>;
      case 'Accepted to Program': return <Badge color="green">Accepted</Badge>;
      case 'On Hold': return <Badge color="gray">On Hold</Badge>;
      case 'Declined / Inactive': return <Badge color="red">Declined</Badge>;
      // Legacy Fallbacks
      case 'Available': return <Badge color="green">Available</Badge>;
      case 'Potential': return <Badge color="blue">Potential</Badge>;
      case 'Pregnant': return <Badge color="red">Pregnant</Badge>;
      default: return <Badge color="gray">{status || 'Unknown'}</Badge>;
    }
  };

  const getDisplayName = (surrogate: User) => {
    const formFirstName = (surrogate.formData as Record<string, unknown> | undefined)?.firstName as string | undefined;
    const formLastName = (surrogate.formData as Record<string, unknown> | undefined)?.lastName as string | undefined;
    const combined = [formFirstName, formLastName].filter(Boolean).join(' ');
    if (combined.length > 0) return combined;

    const firstName = (surrogate.firstName as string | undefined) ?? '';
    const lastName = (surrogate.lastName as string | undefined) ?? '';
    const fallbackCombined = [firstName, lastName].filter(Boolean).join(' ');
    if (fallbackCombined.length > 0) return fallbackCombined;

    return surrogate.email ?? 'Surrogate';
  };

  const getLocation = (surrogate: User) => {
    const formData = surrogate.formData as Record<string, unknown> | undefined;
    const city = (formData?.city as string | undefined) ?? '';
    const state = (formData?.state as string | undefined) ?? '';
    return [city, state].filter(Boolean).join(', ') || 'Not specified';
  };

  const getPhone = (surrogate: User) => {
    const formData = surrogate.formData as Record<string, unknown> | undefined;
    const raw =
      formData?.phone ??
      formData?.phoneNumber ??
      formData?.phone_number ??
      (surrogate as Record<string, unknown>).phone ??
      (surrogate as Record<string, unknown>).phone_number ??
      (surrogate as Record<string, unknown>).phoneNumber;
    if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
    return '—';
  };

  const getExperience = (surrogate: User) => {
    const form2 = (surrogate.form2 as Record<string, unknown> | undefined) ?? {};
    const pregnancies = (form2?.pregnancyHistory as Record<string, unknown> | undefined)?.total as string | undefined;
    return pregnancies ?? ((surrogate.form2 as Record<string, unknown> | undefined)?.surrogacyChildren as string | undefined) ?? '—';
  };

  const getAvailability = (surrogate: User) => {
    const form2 = surrogate.form2 as Record<string, unknown> | undefined;
    const availability = form2?.availability as string | undefined;
    return availability ?? 'Not provided';
  };

  // Per spec: derived read-only eligibility field
  const isEligibleToMatch = (surrogate: User): boolean => {
    if (surrogate.status !== 'Accepted to Program') return false;
    const screening = (surrogate as any).medical_screening_status
      || ((surrogate.formData as any)?.medical_screening_status);
    return !screening || screening === 'Cleared';
  };

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Surrogates Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all registered surrogates and their profiles.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="whitespace-nowrap"
                >
                  <i className="ri-add-line mr-1"></i>
                  Add Surrogate
                </Button>
                <div className="flex bg-gray-100 dark:bg-[#15111f] p-1 rounded-lg w-fit">
                  <button
                    onClick={() => setViewStyle('grid')}
                    className={`p-2 rounded-md transition-colors cursor-pointer ${
                      viewStyle === 'grid'
                        ? 'bg-white dark:bg-white/5 text-rose-500 dark:text-rose-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                    title="Grid View"
                  >
                    <i className="ri-layout-grid-line text-lg"></i>
                  </button>
                  <button
                    onClick={() => setViewStyle('table')}
                    className={`p-2 rounded-md transition-colors cursor-pointer ${
                      viewStyle === 'table'
                        ? 'bg-white dark:bg-white/5 text-rose-500 dark:text-rose-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                    title="Table View"
                  >
                    <i className="ri-table-line text-lg"></i>
                  </button>
                </div>
              </div>
            </div>

          {/* Search and Filter Row */}
          <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by name, email, phone or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#15111f] border border-rose-100/60 dark:border-white/5 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all dark:text-white"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <i className="ri-close-circle-fill"></i>
                </button>
              )}
            </div>
          </div>

          {/* Status Tabs */}
          <div className="mb-6 overflow-x-auto">
            <div className="flex space-x-1 bg-gray-100 dark:bg-[#15111f] p-1 rounded-lg w-fit">
              {statusDefinitions.map((status) => (
                <button
                  key={status.id}
                  onClick={() => setActiveTab(status.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === status.id
                      ? 'bg-white dark:bg-white/5 text-rose-500 dark:text-rose-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {status.label} ({statusCounts[status.id] ?? 0})
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <div className="h-48 w-full rounded-lg bg-gray-100 dark:bg-[#15111f]" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              {filteredSurrogates.length === 0 ? (
                <Card className="p-6 text-center text-gray-600 dark:text-gray-300">
                  No surrogate profiles match this filter.
                </Card>
              ) : viewStyle === 'grid' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredSurrogates.map((surrogate) => (
                    <Card
                      key={surrogate.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setSelectedSurrogate(surrogate)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center">
                            <i className="ri-user-heart-line text-pink-600 dark:text-pink-400 text-lg"></i>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{getDisplayName(surrogate)}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 break-all">ID: {surrogate.id}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(surrogate)}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isEligibleToMatch(surrogate)
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                          }`}>
                            {isEligibleToMatch(surrogate) ? '✓ Eligible to Match' : '✗ Not Eligible'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Email:</span>
                          <span className="text-gray-900 dark:text-white text-right break-words">{surrogate.email ?? '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Phone:</span>
                          <span className="text-gray-900 dark:text-white text-right break-words">{getPhone(surrogate)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Location:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getLocation(surrogate)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Experience:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getExperience(surrogate)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Availability:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getAvailability(surrogate)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={(event: React.MouseEvent) => {
                            event.stopPropagation();
                            navigate(`/surrogates/${surrogate.id}`);
                          }}
                        >
                          <i className="ri-eye-line mr-1"></i>
                          View Profile
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs uppercase">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Name</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                          <th className="px-6 py-3 font-semibold">Email</th>
                          <th className="px-6 py-3 font-semibold">Phone</th>
                          <th className="px-6 py-3 font-semibold">Location</th>
                          <th className="px-6 py-3 font-semibold">Experience</th>
                          <th className="px-6 py-3 font-semibold text-center">Profile</th>
                          <th className="px-6 py-3 font-semibold text-center">Form 2</th>
                          <th className="px-6 py-3 font-semibold">Joined</th>
                          <th className="px-6 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredSurrogates.map((surrogate) => (
                          <tr 
                            key={surrogate.id} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedSurrogate(surrogate)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center flex-shrink-0">
                                  <i className="ri-user-heart-line text-pink-600 dark:text-pink-400 text-sm"></i>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {getDisplayName(surrogate)}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                                    {surrogate.id.split('-')[0]}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(surrogate)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 dark:text-white truncate max-w-[180px]" title={surrogate.email}>
                                {surrogate.email ?? '—'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {getPhone(surrogate)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {getLocation(surrogate)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {getExperience(surrogate)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {surrogate.profileCompleted ? (
                                <Badge color="green">Yes</Badge>
                              ) : (
                                <Badge color="yellow">No</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {surrogate.form2Completed ? (
                                <Badge color="green">Yes</Badge>
                              ) : (
                                <Badge color="yellow">No</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {formatMMDDYYYY(surrogate.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event: React.MouseEvent) => {
                                    event.stopPropagation();
                                    navigate(`/surrogates/${surrogate.id}`);
                                  }}
                                  className="hover:bg-rose-50 dark:hover:bg-white/5"
                                >
                                  <i className="ri-eye-line text-rose-500"></i>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Surrogate Detail Modal */}
          {selectedSurrogate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Surrogate Profile</h2>
                    <button
                      onClick={() => setSelectedSurrogate(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center">
                        <i className="ri-user-heart-line text-pink-600 dark:text-pink-400 text-2xl"></i>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{getDisplayName(selectedSurrogate)}</h3>
                        <p className="text-gray-600 dark:text-gray-400 break-all mb-2">Surrogate ID: {selectedSurrogate.id}</p>
                        
                        {/* Status Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                          <div className="relative">
                            <select
                              value={selectedSurrogate.status || ''}
                              onChange={(e) => handleStatusUpdate(selectedSurrogate.id, e.target.value as UserStatus)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white py-1 pl-2 pr-8"
                            >
                              <option value="">Select Status</option>
                              {GC_STATUSES.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </div>
                          {getStatusBadge(selectedSurrogate)}
                        </div>
                      </div>
                    </div>

                    <DataSection
                      title="Profile Overview"
                      data={{
                        Email: selectedSurrogate.email,
                        Phone: getPhone(selectedSurrogate),
                        Role: selectedSurrogate.role,
                        'Profile Completed': selectedSurrogate.profileCompleted,
                        'Form 2 Completed': selectedSurrogate.form2Completed,
                        'Created At': selectedSurrogate.createdAt,
                        'Updated At': selectedSurrogate.updatedAt
                      }}
                    />
                    <DataSection
                      title="Form 1 Responses"
                      data={(selectedSurrogate.formData as Record<string, unknown>) ?? null}
                      emptyMessage="No form data available."
                    />
                    <DataSection
                      title="Form 2 Responses (Education, Employment & Medical)"
                      data={
                        (selectedSurrogate.surrogateProfile as Record<string, unknown>) ??
                        (selectedSurrogate.form2 as Record<string, unknown>) ??
                        ((selectedSurrogate.formData as Record<string, unknown>)?.surrogate_profile as Record<string, unknown>) ??
                        null
                      }
                      emptyMessage="Form 2 has not been completed."
                    />
                    <DataSection
                      title="Additional Profile Data"
                      data={
                        (selectedSurrogate.additionalProfile as Record<string, unknown>) ??
                        (selectedSurrogate.form2Data as Record<string, unknown>) ??
                        null
                      }
                      emptyMessage="No additional data provided (mobile app stores extended intake under Form 2 / surrogate_profile; use gc_additional only if you add it)."
                    />

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1" disabled={selectedSurrogate.status !== 'Accepted to Program'}>
                        <i className="ri-links-line mr-2"></i>
                        Create Match
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-message-line mr-2"></i>
                        Send Message
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-edit-line mr-2"></i>
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <AddUserDialog
        isOpen={isAddDialogOpen}
        role="Surrogate"
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={fetchSurrogates}
      />
    </div>
  );
};

export default SurrogatesPage;
