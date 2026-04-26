import React, { useMemo, useState, useEffect } from 'react';
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
import { IP_STATUSES } from '../../types';
import { formatMMDDYYYY } from '../../utils/dateFormat';

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
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('table');
  const [selectedParent, setSelectedParent] = useState<User | null>(null);
  const [parents, setParents] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const navigate = useNavigate();

  const fetchParents = async () => {
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('*')
        .in('role', ['Intended Parent', 'intendedParent']);

      if (err) throw err;
      
      const mappedData: User[] = (data || []).map(u => {
        const formData = u.form_data || u.formData || u.formdata || {};
        return {
          id: u.id,
          ...u,
          profileCompleted: u.profile_completed || u.profileCompleted,
          form2Completed: u.form2_completed || u.form2Completed || u.form_2_completed,
          formData: formData,
          form2Data: u.form2_data || u.form2Data || u.form2data,
          // Extract parent2 and other nested data from form_data
          parent1: u.parent1 || formData?.parent1 || null,
          parent2: u.parent2 || formData?.parent2 || null,
          surrogateRelated: u.surrogateRelated || formData?.surrogate_related || formData?.surrogateRelated || null,
          updatedAt: u.updated_at,
          createdAt: u.created_at
        };
      });
      
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
    let filtered = currentStatus ? parents.filter((parent) => currentStatus.filter(parent)) : parents;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(parent => {
        const name = getDisplayName(parent).toLowerCase();
        const email = (parent.email || '').toLowerCase();
        const id = (parent.id || '').toLowerCase();
        return name.includes(query) || email.includes(query) || id.includes(query);
      });
    }
    
    return filtered;
  }, [activeTab, parents, searchQuery]);

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

  // Per spec: IP is eligible to match only if Accepted to Program
  const isEligibleToMatch = (parent: User): boolean => parent.status === 'Accepted to Program';

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Intended Parents</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all intended parents and their journey progress.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="whitespace-nowrap"
                >
                  <i className="ri-add-line mr-1"></i>
                  Add Intended Parent
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
                placeholder="Search by name, email or ID..."
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
              {filteredParents.length === 0 ? (
                <Card className="p-6 text-center text-gray-600 dark:text-gray-300">
                  No intended parents found for this filter.
                </Card>
              ) : viewStyle === 'grid' ? (
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
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(parent)}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isEligibleToMatch(parent)
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                          }`}>
                            {isEligibleToMatch(parent) ? '✓ Eligible to Match' : '✗ Not Eligible'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Email:</span>
                          <span className="text-gray-900 dark:text-white break-words text-right">{parent.email ?? '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Location:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getLocation(parent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Timeline:</span>
                          <span className="text-gray-900 dark:text-white text-right">{getTimeline(parent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Budget:</span>
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
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs uppercase">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Name</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                          <th className="px-6 py-3 font-semibold">Email</th>
                          <th className="px-6 py-3 font-semibold">Location</th>
                          <th className="px-6 py-3 font-semibold">Timeline</th>
                          <th className="px-6 py-3 font-semibold text-center">Profile</th>
                          <th className="px-6 py-3 font-semibold text-center">Form 2</th>
                          <th className="px-6 py-3 font-semibold">Joined</th>
                          <th className="px-6 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredParents.map((parent) => (
                          <tr 
                            key={parent.id} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedParent(parent)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                                  <i className="ri-parent-line text-purple-600 dark:text-purple-400 text-sm"></i>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {getDisplayName(parent)}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                                    {parent.id.split('-')[0]}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(parent)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 dark:text-white truncate max-w-[180px]" title={parent.email}>
                                {parent.email ?? '—'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {getLocation(parent)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {getTimeline(parent)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {parent.profileCompleted ? (
                                <Badge color="green">Yes</Badge>
                              ) : (
                                <Badge color="yellow">No</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {parent.form2Completed ? (
                                <Badge color="green">Yes</Badge>
                              ) : (
                                <Badge color="yellow">No</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {formatMMDDYYYY(parent.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event: React.MouseEvent) => {
                                    event.stopPropagation();
                                    navigate(`/parents/${parent.id}`);
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

          {/* Parent Detail Modal */}
          {selectedParent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
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
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{getDisplayName(selectedParent)}</h3>
                        <p className="text-gray-600 dark:text-gray-400 break-all mb-2">Parent ID: {selectedParent.id}</p>
                        
                        {/* Status Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                          <div className="relative">
                            <select
                              value={selectedParent.status || ''}
                              onChange={(e) => handleStatusUpdate(selectedParent.id, e.target.value as UserStatus)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white py-1 pl-2 pr-8"
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
                      data={
                        (selectedParent.form2Data as Record<string, unknown>) ??
                        ((selectedParent.formData as Record<string, unknown>)?.fertility as Record<string, unknown>) ??
                        null
                      }
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

      <AddUserDialog
        isOpen={isAddDialogOpen}
        role="Intended Parent"
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={fetchParents}
      />
    </div>
  );
};

export default ParentsPage;
