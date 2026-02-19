import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import DataSection from '../../components/data/DataSection';
import type { User, UserStatus } from '../../types';
import { IP_STATUSES } from '../../types';

const statusDefinitions = [
  {
    id: 'all',
    label: 'All',
    filter: (_parent: User) => true
  },
  {
    id: 'new_inquiry',
    label: 'New Inquiry',
    filter: (parent: User) => parent.status === 'New Inquiry'
  },
  {
    id: 'consultation',
    label: 'Consultation Complete',
    filter: (parent: User) => parent.status === 'Consultation Complete'
  },
  {
    id: 'intake',
    label: 'Intake in Progress',
    filter: (parent: User) => parent.status === 'Intake in Progress'
  },
  {
    id: 'accepted',
    label: 'Accepted',
    filter: (parent: User) => parent.status === 'Accepted to Program'
  },
  {
    id: 'on_hold',
    label: 'On Hold',
    filter: (parent: User) => parent.status === 'On Hold'
  },
  {
    id: 'declined',
    label: 'Declined',
    filter: (parent: User) => parent.status === 'Declined / Inactive'
  }
];

const ParentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedParent, setSelectedParent] = useState<User | null>(null);
  const [parents, setParents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchParents = async () => {
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('*')
        .in('role', ['Intended Parent', 'intendedParent']);

      if (err) throw err;
      
      const mappedData: User[] = (data || []).map(u => ({
        id: u.id,
        ...u,
        profileCompleted: u.profile_completed || u.profileCompleted,
        form2Completed: u.form2_completed || u.form2Completed || u.form_2_completed,
        formData: u.form_data || u.formData || u.formdata,
        form2Data: u.form2_data || u.form2Data || u.form2data,
        updatedAt: u.updated_at,
        createdAt: u.created_at
      }));
      
      setParents(mappedData);
      setIsLoading(false);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load intended parents', err);
      setError('Unable to load intended parent records. Please try again later.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();

    const channel = supabase
      .channel('public:users:parents')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'users'
        // Filter in JS/TS as .in() is not supported directly in the payload filter for some Supabase client versions
      }, (payload: any) => {
        if (payload.new && (payload.new.role === 'Intended Parent' || payload.new.role === 'intendedParent')) {
            fetchParents();
        } else if (payload.old && (payload.old.role === 'Intended Parent' || payload.old.role === 'intendedParent')) {
            fetchParents();
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
      
      if (selectedParent && selectedParent.id === userId) {
        setSelectedParent({ ...selectedParent, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const statusCounts = useMemo(() => {
    return statusDefinitions.reduce<Record<string, number>>((acc, status) => {
      acc[status.id] = parents.filter((parent) => status.filter(parent)).length;
      return acc;
    }, {});
  }, [parents]);

  const filteredParents = useMemo(() => {
    const currentStatus = statusDefinitions.find((status) => status.id === activeTab);
    if (!currentStatus) return parents;
    return parents.filter((parent) => currentStatus.filter(parent));
  }, [activeTab, parents]);

  const getStatusBadge = (parent: User) => {
    const status = parent.status;
    switch (status) {
      case 'New Inquiry': return <Badge color="blue">New Inquiry</Badge>;
      case 'Consultation Complete': return <Badge color="indigo">Consultation</Badge>;
      case 'Intake in Progress': return <Badge color="yellow">Intake</Badge>;
      case 'Accepted to Program': return <Badge color="green">Accepted</Badge>;
      case 'On Hold': return <Badge color="gray">On Hold</Badge>;
      case 'Declined / Inactive': return <Badge color="red">Declined</Badge>;
      // Legacy Fallbacks
      case 'To be Matched': return <Badge color="yellow">To be Matched</Badge>;
      case 'Matched': return <Badge color="green">Matched</Badge>;
      default: return <Badge color="gray">{status || 'Unknown'}</Badge>;
    }
  };

  const getDisplayName = (parent: User) => {
    const parentName = (parent.parent1 as Record<string, unknown> | undefined)?.name as string | undefined;
    if (parentName && parentName.trim().length > 0) return parentName;

    const formFirstName = (parent.formData as Record<string, unknown> | undefined)?.firstName as string | undefined;
    const formLastName = (parent.formData as Record<string, unknown> | undefined)?.lastName as string | undefined;
    const combined = [formFirstName, formLastName].filter(Boolean).join(' ');
    if (combined.length > 0) return combined;

    const firstName = (parent.firstName as string | undefined) ?? '';
    const lastName = (parent.lastName as string | undefined) ?? '';
    const fallbackCombined = [firstName, lastName].filter(Boolean).join(' ');
    if (fallbackCombined.length > 0) return fallbackCombined;

    return parent.email ?? 'Intended Parent';
  };

  const getLocation = (parent: User) => {
    const formData = parent.formData as Record<string, unknown> | undefined;
    const city = (formData?.city as string | undefined) ?? '';
    const state = (formData?.state as string | undefined) ?? '';
    return [city, state].filter(Boolean).join(', ') || 'Not specified';
  };

  const getTimeline = (parent: User) => {
    return ((parent.formData as Record<string, unknown> | undefined)?.whenToStart as string | undefined) ?? 'No timeline set';
  };

  const getBudget = (parent: User) => {
    return ((parent.form2Data as Record<string, unknown> | undefined)?.budget as string | undefined) ?? 'Not provided';
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Intended Parents</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage all intended parents and their journey progress.</p>
          </div>

          {/* Status Tabs */}
          <div className="mb-6 overflow-x-auto">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {statusDefinitions.map((status) => (
                <button
                  key={status.id}
                  onClick={() => setActiveTab(status.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === status.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
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
                  <div className="h-48 w-full rounded-lg bg-gray-100 dark:bg-gray-800" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              {filteredParents.length === 0 ? (
                <Card className="p-6 text-center text-gray-600 dark:text-gray-300">
                  No intended parents found for this filter.
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredParents.map((parent) => (
                    <Card
                      key={parent.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setSelectedParent(parent)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                            <i className="ri-parent-line text-purple-600 dark:text-purple-400 text-lg"></i>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{getDisplayName(parent)}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 break-all">ID: {parent.id}</p>
                          </div>
                        </div>
                        {getStatusBadge(parent)}
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Email:</span>
                          <span className="text-gray-900 dark:text-white break-words text-right">{parent.email ?? '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Location:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getLocation(parent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Timeline:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getTimeline(parent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Budget:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getBudget(parent)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={(event: React.MouseEvent) => {
                            event.stopPropagation();
                            navigate(`/parents/${parent.id}`);
                          }}
                        >
                          <i className="ri-eye-line mr-1"></i>
                          View Profile
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Parent Detail Modal */}
          {selectedParent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Intended Parents Profile</h2>
                    <button
                      onClick={() => setSelectedParent(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                        <i className="ri-parent-line text-purple-600 dark:text-purple-400 text-2xl"></i>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{getDisplayName(selectedParent)}</h3>
                        <p className="text-gray-600 dark:text-gray-400 break-all mb-2">Parent ID: {selectedParent.id}</p>
                        
                        {/* Status Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                          <div className="relative">
                            <select
                              value={selectedParent.status || ''}
                              onChange={(e) => handleStatusUpdate(selectedParent.id, e.target.value as UserStatus)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white py-1 pl-2 pr-8"
                            >
                              <option value="">Select Status</option>
                              {IP_STATUSES.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </div>
                          {getStatusBadge(selectedParent)}
                        </div>
                      </div>
                    </div>

                    <DataSection
                      title="Profile Overview"
                      data={{
                        Email: selectedParent.email,
                        Role: selectedParent.role,
                        'Profile Completed': selectedParent.profileCompleted,
                        'Form 2 Completed': selectedParent.form2Completed,
                        'Created At': selectedParent.createdAt,
                        'Updated At': selectedParent.updatedAt
                      }}
                    />
                    
                    {/* ... Rest of DataSections (same as before) ... */}
                    <DataSection
                      title="Form 1 Responses"
                      data={(selectedParent.formData as Record<string, unknown>) ?? null}
                      emptyMessage="No form data available."
                    />
                    <DataSection
                      title="Form 2 Responses"
                      data={(selectedParent.form2Data as Record<string, unknown>) ?? null}
                      emptyMessage="Form 2 has not been completed."
                    />
                    <DataSection
                      title="Fertility Information"
                      data={((selectedParent.form2Data as Record<string, unknown>)?.fertility as Record<string, unknown>) ?? null}
                      emptyMessage="No fertility information provided."
                    />
                    <DataSection
                      title="Parent 1"
                      data={(selectedParent.parent1 as Record<string, unknown>) ?? null}
                      emptyMessage="Parent 1 details not provided."
                    />
                    <DataSection
                      title="Parent 2"
                      data={(selectedParent.parent2 as Record<string, unknown>) ?? null}
                      emptyMessage="Parent 2 details not provided."
                    />
                    <DataSection
                      title="Surrogate Preferences"
                      data={(selectedParent.surrogateRelated as Record<string, unknown>) ?? null}
                      emptyMessage="No surrogate preferences captured."
                    />

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1" disabled={selectedParent.status !== 'Accepted to Program'}>
                        <i className="ri-links-line mr-2"></i>
                        Find Match
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-message-line mr-2"></i>
                        Send Message
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ParentsPage;
