import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import EditableJsonSection from '../../components/data/EditableJsonSection';
import { db } from '../../lib/firebase';

const PARENT_CORE_FIELDS = ['firstName', 'lastName', 'role', 'profileCompleted', 'form2Completed', 'profileCompletedAt', 'form2CompletedAt'] as const;

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
} | null;

const ParentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [parent, setParent] = useState<FirestoreUser>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parentDocRef = useMemo(() => (id ? doc(db, 'users', id) : null), [id]);

  useEffect(() => {
    if (!id) {
      setError('No parent id provided.');
      setIsLoading(false);
      return;
    }

    if (!parentDocRef) {
      setParent(null);
      setError('Parent profile not found.');
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      parentDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setParent(null);
          setError('Parent profile not found.');
        } else {
          setParent({
            id: snapshot.id,
            ...(snapshot.data() as Record<string, unknown>)
          });
          setError(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('Failed to load parent profile', err);
        setError('Unable to load parent profile. Please try again later.');
        setParent(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, parentDocRef]);

  const formatDateTime = (value: unknown) => {
    if (!value) return '—';
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toLocaleString();
    }
    return String(value);
  };

  const displayName = useMemo(() => {
    if (!parent) return 'Parent Profile';

    const parentName = (parent.parent1 as Record<string, unknown> | undefined)?.name as string | undefined;
    if (parentName && parentName.trim().length > 0) return parentName;

    const formFirstName = (parent.formData as Record<string, unknown> | undefined)?.firstName as string | undefined;
    const formLastName = (parent.formData as Record<string, unknown> | undefined)?.lastName as string | undefined;
    const combined = [formFirstName, formLastName].filter(Boolean).join(' ');
    if (combined.length > 0) return combined;

    const firstName = parent.firstName ?? '';
    const lastName = parent.lastName ?? '';
    const fallbackCombined = [firstName, lastName].filter(Boolean).join(' ');
    if (fallbackCombined.length > 0) return fallbackCombined;

    return parent.email ?? 'Parent Profile';
  }, [parent]);

  const initials = useMemo(() => {
    if (!displayName) return 'FM';
    return displayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FM';
  }, [displayName]);

  const location = useMemo(() => {
    if (!parent) return null;
    const formData = parent.formData as Record<string, unknown> | undefined;
    const city = (formData?.city as string | undefined)?.trim();
    const state = (formData?.state as string | undefined)?.trim();
    const combined = [city, state].filter(Boolean).join(', ');
    return combined.length > 0 ? combined : null;
  }, [parent]);

  const timeline = useMemo(() => {
    if (!parent) return null;
    const whenToStart = (parent.formData as Record<string, unknown> | undefined)?.whenToStart as string | undefined;
    return whenToStart ?? null;
  }, [parent]);

  const createdAtText = useMemo(() => formatDateTime(parent?.createdAt), [parent]);
  const updatedAtText = useMemo(() => formatDateTime(parent?.updatedAt), [parent]);

  const heroMeta = useMemo(
    () =>
      [
        parent?.email && {
          icon: 'ri-mail-line',
          label: 'Email',
          value: parent.email as string
        },
        location && {
          icon: 'ri-map-pin-line',
          label: 'Location',
          value: location
        },
        timeline && {
          icon: 'ri-timer-line',
          label: 'Intended Timeline',
          value: timeline
        }
      ].filter(Boolean) as Array<{ icon: string; label: string; value: string }>,
    [location, parent?.email, timeline]
  );

  const summaryCards = useMemo(
    () => [
      {
        label: 'Profile Status',
        value: parent?.profileCompleted ? 'Complete' : 'In Progress',
        icon: parent?.profileCompleted ? 'ri-shield-check-line' : 'ri-time-line',
        className: parent?.profileCompleted
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      },
      {
        label: 'Form 2',
        value: parent?.form2Completed ? 'Submitted' : 'Pending',
        icon: parent?.form2Completed ? 'ri-file-check-line' : 'ri-draft-line',
        className: parent?.form2Completed
          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      },
      {
        label: 'Created',
        value: createdAtText,
        icon: 'ri-calendar-line',
        className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
      },
      {
        label: 'Last Updated',
        value: updatedAtText,
        icon: 'ri-refresh-line',
        className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
      }
    ],
    [createdAtText, parent?.form2Completed, parent?.profileCompleted, updatedAtText]
  );

  const coreProfileData = useMemo(() => {
    if (!parent) return null;
    return PARENT_CORE_FIELDS.reduce<Record<string, unknown>>((acc, key) => {
      if (key in parent && parent[key as keyof Exclude<FirestoreUser, null>] !== undefined) {
        acc[key] = parent[key as keyof Exclude<FirestoreUser, null>];
      }
      return acc;
    }, {});
  }, [parent]);

  const handleUpdateField = useCallback(
    async (field: string, value: Record<string, unknown>) => {
      if (!parentDocRef) return;
      await updateDoc(parentDocRef, { [field]: value });
    },
    [parentDocRef]
  );

  const handleUpdateCore = useCallback(
    async (value: Record<string, unknown>) => {
      if (!parentDocRef) return;
      const filteredValue = Object.keys(value).reduce<Record<string, unknown>>((acc, key) => {
        if (PARENT_CORE_FIELDS.includes(key as (typeof PARENT_CORE_FIELDS)[number])) {
          acc[key] = value[key];
        }
        return acc;
      }, {});

      if (Object.keys(filteredValue).length === 0) return;
      await updateDoc(parentDocRef, filteredValue);
    },
    [parentDocRef]
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate('/parents')}>
              <i className="ri-arrow-left-line mr-2"></i>
              Back to list
            </Button>
          </div>

          {isLoading ? (
            <div className="grid gap-6">
              <Card className="animate-pulse h-48">
                <div className="h-full w-full rounded-xl bg-gray-100 dark:bg-gray-800" />
              </Card>
              <Card className="animate-pulse h-48">
                <div className="h-full w-full rounded-xl bg-gray-100 dark:bg-gray-800" />
              </Card>
            </div>
          ) : error ? (
            <Card className="p-6 text-red-600 dark:text-red-400">{error}</Card>
          ) : !parent ? (
            <Card className="p-6 text-gray-600 dark:text-gray-300">Parent profile not found.</Card>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_60%)] opacity-70" />
                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-3xl font-semibold backdrop-blur-xl">
                      {initials}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-semibold leading-tight">{displayName}</h1>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                          <i className="ri-parent-line text-sm"></i>
                          Intended Parent
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-white/80">
                        Building their family journey through the Family Matters program.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-white/90">
                        {heroMeta.map((item) => (
                          <span
                            key={item.label}
                            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md"
                          >
                            <i className={`${item.icon} text-base text-white/90`}></i>
                            <span>{item.value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 text-sm text-white/80">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                      <i className="ri-hashtag text-base text-white/90"></i>
                      ID: {parent.id}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <Card
                    key={card.label}
                    padding="sm"
                    className={`${card.className} border-none shadow-sm backdrop-blur`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
                        <p className="mt-2 text-lg font-semibold">{card.value}</p>
                      </div>
                      <span className="text-xl opacity-70">
                        <i className={card.icon}></i>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card className="xl:col-span-2">
                  <EditableJsonSection
                    title="Core Profile"
                    description="Update top-level information such as role and completion status. For contact details, edit the form responses below."
                    data={coreProfileData}
                    emptyMessage="No core profile data available."
                    onSave={handleUpdateCore}
                  />
                </Card>
                <Card>
                  <EditableJsonSection
                    title="Form 1 Responses"
                    description="Update the intake details shared by the intended parents."
                    data={(parent.formData as Record<string, unknown>) ?? null}
                    emptyMessage="No form data available."
                    onSave={(value) => handleUpdateField('formData', value)}
                  />
                </Card>
                <Card>
                  <EditableJsonSection
                    title="Form 2 Responses"
                    description="Modify the extended questionnaire answers for this family."
                    data={(parent.form2Data as Record<string, unknown>) ?? null}
                    emptyMessage="Form 2 has not been completed."
                    onSave={(value) => handleUpdateField('form2Data', value)}
                  />
                </Card>
                <Card className="xl:col-span-2">
                  <EditableJsonSection
                    title="Fertility Information"
                    description="Capture fertility clinic, embryo and related details."
                    data={((parent.form2Data as Record<string, unknown>)?.fertility as Record<string, unknown>) ?? null}
                    emptyMessage="No fertility information provided."
                    onSave={(value) => handleUpdateField('form2Data.fertility', value)}
                  />
                </Card>
                <Card>
                  <EditableJsonSection
                    title="Parent 1"
                    description="Edit details for Parent 1."
                    data={(parent.parent1 as Record<string, unknown>) ?? null}
                    emptyMessage="Parent 1 details not provided."
                    onSave={(value) => handleUpdateField('parent1', value)}
                  />
                </Card>
                <Card>
                  <EditableJsonSection
                    title="Parent 2"
                    description="Edit details for Parent 2."
                    data={(parent.parent2 as Record<string, unknown>) ?? null}
                    emptyMessage="Parent 2 details not provided."
                    onSave={(value) => handleUpdateField('parent2', value)}
                  />
                </Card>
                <Card className="xl:col-span-2">
                  <EditableJsonSection
                    title="Surrogate Preferences"
                    description="Fine-tune the family's preferences for potential surrogates."
                    data={(parent.surrogateRelated as Record<string, unknown>) ?? null}
                    emptyMessage="No surrogate preferences captured."
                    onSave={(value) => handleUpdateField('surrogateRelated', value)}
                  />
                </Card>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ParentProfilePage;

