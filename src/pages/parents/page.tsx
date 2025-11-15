
import React, { useMemo, useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import DataSection from '../../components/data/DataSection';
import { db } from '../../lib/firebase';

type FirestoreUser = {
  id: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  formData?: Record<string, unknown>;
  form2Data?: Record<string, unknown>;
  parent1?: Record<string, unknown>;
  parent2?: Record<string, unknown>;
  surrogateRelated?: Record<string, unknown>;
  form2Completed?: boolean;
  profileCompleted?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
};

const statusDefinitions = [
  {
    id: 'all',
    label: 'All',
    filter: (_parent: FirestoreUser) => true
  },
  {
    id: 'profileComplete',
    label: 'Profile Complete',
    filter: (parent: FirestoreUser) => Boolean(parent.profileCompleted)
  },
  {
    id: 'form2Complete',
    label: 'Form 2 Complete',
    filter: (parent: FirestoreUser) => Boolean(parent.form2Completed)
  }
];

const ParentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedParent, setSelectedParent] = useState<FirestoreUser | null>(null);
  const [parents, setParents] = useState<FirestoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const parentsQuery = query(collection(db, 'users'), where('role', '==', 'Intended Parent'));

    const unsubscribe = onSnapshot(
      parentsQuery,
      (snapshot) => {
        const data: FirestoreUser[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Record<string, unknown>)
        }));
        setParents(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to load intended parents', err);
        setError('Unable to load intended parent records. Please try again later.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

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

  const getStatusBadge = (parent: FirestoreUser) => {
    if (parent.form2Completed) {
      return <Badge color="green">Form 2 Complete</Badge>;
    }
    if (parent.profileCompleted) {
      return <Badge color="blue">Profile Complete</Badge>;
    }
    return <Badge color="yellow">In Progress</Badge>;
  };

  const getDisplayName = (parent: FirestoreUser) => {
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

  const getLocation = (parent: FirestoreUser) => {
    const formData = parent.formData as Record<string, unknown> | undefined;
    const city = (formData?.city as string | undefined) ?? '';
    const state = (formData?.state as string | undefined) ?? '';
    return [city, state].filter(Boolean).join(', ') || 'Not specified';
  };

  const getTimeline = (parent: FirestoreUser) => {
    return ((parent.formData as Record<string, unknown> | undefined)?.whenToStart as string | undefined) ?? 'No timeline set';
  };

  const getBudget = (parent: FirestoreUser) => {
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
          <div className="mb-6">
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
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/parents/${parent.id}`);
                          }}
                        >
                          <i className="ri-eye-line mr-1"></i>
                          View Profile
                        </Button>
                        <Button size="sm" color="blue">
                          <i className="ri-message-line"></i>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Parents Grid */}
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
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{getDisplayName(selectedParent)}</h3>
                        <p className="text-gray-600 dark:text-gray-400 break-all">Parent ID: {selectedParent.id}</p>
                        {getStatusBadge(selectedParent)}
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
                      <Button color="blue" className="flex-1">
                        <i className="ri-links-line mr-2"></i>
                        Find Match
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
    </div>
  );
};

export default ParentsPage;
