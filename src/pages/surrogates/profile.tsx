import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import EditableJsonSection from '../../components/data/EditableJsonSection';
import Toast from '../../components/base/Toast';
import { db } from '../../lib/firebase';
import {
  CORE_PROFILE_TEMPLATE,
  FORM_CONTACT_TEMPLATE,
  SURROGATE_FORM2_TEMPLATE,
  SURROGATE_ADDITIONAL_TEMPLATE
} from '../../constants/jsonTemplates';

const SURROGATE_CORE_FIELDS = ['firstName', 'lastName', 'role', 'profileCompleted', 'form2Completed', 'profileCompletedAt', 'form2CompletedAt'] as const;

type FirestoreUser = {
  id: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  formData?: Record<string, unknown>;
  form2?: Record<string, unknown>;
  form2Data?: Record<string, unknown>;
  form2Completed?: boolean;
  profileCompleted?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  status?: string;
  [key: string]: unknown;
} | null;

const SURROGATE_STATUSES = [
  'Available',
  'Potential',
  'Records Review',
  'Screening',
  'Legal',
  'Cycling',
  'Pregnant'
] as const;

const SurrogateProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [surrogate, setSurrogate] = useState<FirestoreUser>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const surrogateDocRef = useMemo(() => (id ? doc(db, 'users', id) : null), [id]);

  useEffect(() => {
    if (!id) {
      setError('No surrogate id provided.');
      setIsLoading(false);
      return;
    }

    if (!surrogateDocRef) {
      setSurrogate(null);
      setError('Surrogate profile not found.');
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      surrogateDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSurrogate(null);
          setError('Surrogate profile not found.');
        } else {
          setSurrogate({
            id: snapshot.id,
            ...(snapshot.data() as Record<string, unknown>)
          });
          setError(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('Failed to load surrogate profile', err);
        setError('Unable to load surrogate profile. Please try again later.');
        setSurrogate(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, surrogateDocRef]);

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
    if (!surrogate) return 'Surrogate Profile';

    const formFirstName = (surrogate.formData as Record<string, unknown> | undefined)?.firstName as string | undefined;
    const formLastName = (surrogate.formData as Record<string, unknown> | undefined)?.lastName as string | undefined;
    const combined = [formFirstName, formLastName].filter(Boolean).join(' ');
    if (combined.length > 0) return combined;

    const firstName = surrogate.firstName ?? '';
    const lastName = surrogate.lastName ?? '';
    const fallbackCombined = [firstName, lastName].filter(Boolean).join(' ');
    if (fallbackCombined.length > 0) return fallbackCombined;

    return surrogate.email ?? 'Surrogate Profile';
  }, [surrogate]);

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
    if (!surrogate) return null;
    const formData = surrogate.formData as Record<string, unknown> | undefined;
    const city = (formData?.city as string | undefined)?.trim();
    const state = (formData?.state as string | undefined)?.trim();
    const combined = [city, state].filter(Boolean).join(', ');
    return combined.length > 0 ? combined : null;
  }, [surrogate]);

  const availability = useMemo(() => {
    if (!surrogate) return null;
    const form2 = surrogate.form2 as Record<string, unknown> | undefined;
    const value = (form2?.availability as string | undefined) ?? (surrogate.form2Data as Record<string, unknown> | undefined)?.availability;
    return value ? String(value) : null;
  }, [surrogate]);

  const experience = useMemo(() => {
    if (!surrogate) return null;
    const form2 = (surrogate.form2 as Record<string, unknown> | undefined) ?? {};
    const pregnancies = (form2?.pregnancyHistory as Record<string, unknown> | undefined)?.total as string | undefined;
    const surrogacyChildren = (form2?.surrogacyChildren as string | undefined) ?? (surrogate.form2Data as Record<string, unknown> | undefined)?.surrogacyChildren;
    if (pregnancies) return `${pregnancies} pregnancies`;
    if (surrogacyChildren) return `${surrogacyChildren} surrogacy journey${surrogacyChildren === '1' ? '' : 's'}`;
    return null;
  }, [surrogate]);

  const createdAtText = useMemo(() => formatDateTime(surrogate?.createdAt), [surrogate]);
  const updatedAtText = useMemo(() => formatDateTime(surrogate?.updatedAt), [surrogate]);

  const heroMeta = useMemo(
    () =>
      [
        surrogate?.email && {
          icon: 'ri-mail-line',
          label: 'Email',
          value: surrogate.email as string
        },
        location && {
          icon: 'ri-map-pin-line',
          label: 'Location',
          value: location
        },
        availability && {
          icon: 'ri-calendar-check-line',
          label: 'Availability',
          value: availability
        }
      ].filter(Boolean) as Array<{ icon: string; label: string; value: string }>,
    [availability, location, surrogate?.email]
  );

  const summaryCards = useMemo(
    () => [
      {
        label: 'Profile Status',
        value: surrogate?.profileCompleted ? 'Ready' : 'In Progress',
        icon: surrogate?.profileCompleted ? 'ri-heart-3-line' : 'ri-time-line',
        className: surrogate?.profileCompleted
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      },
      {
        label: 'Form 2',
        value: surrogate?.form2Completed ? 'Complete' : 'Pending',
        icon: surrogate?.form2Completed ? 'ri-clipboard-check-line' : 'ri-clipboard-line',
        className: surrogate?.form2Completed
          ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20'
          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      },
      {
        label: 'Experience',
        value: experience ?? '—',
        icon: 'ri-user-heart-line',
        className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
      },
      {
        label: 'Last Updated',
        value: updatedAtText,
        icon: 'ri-refresh-line',
        className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
      }
    ],
    [experience, surrogate?.form2Completed, surrogate?.profileCompleted, updatedAtText]
  );

  const coreProfileData = useMemo(() => {
    if (!surrogate) return null;
    return SURROGATE_CORE_FIELDS.reduce<Record<string, unknown>>((acc, key) => {
      if (key in surrogate && surrogate[key as keyof Exclude<FirestoreUser, null>] !== undefined) {
        acc[key] = surrogate[key as keyof Exclude<FirestoreUser, null>];
      }
      return acc;
    }, {});
  }, [surrogate]);

  const handleUpdateField = useCallback(
    async (field: string, value: Record<string, unknown>) => {
      if (!surrogateDocRef) return;
      await updateDoc(surrogateDocRef, { [field]: value });
    },
    [surrogateDocRef]
  );

  const handleUpdateCore = useCallback(
    async (value: Record<string, unknown>) => {
      if (!surrogateDocRef) return;
      const filteredValue = Object.keys(value).reduce<Record<string, unknown>>((acc, key) => {
        if (SURROGATE_CORE_FIELDS.includes(key as (typeof SURROGATE_CORE_FIELDS)[number])) {
          acc[key] = value[key];
        }
        return acc;
      }, {});

      if (Object.keys(filteredValue).length === 0) return;
      await updateDoc(surrogateDocRef, filteredValue);
    },
    [surrogateDocRef]
  );
  
  const handleStatusChange = async (newStatus: string) => {
    if (!surrogateDocRef) return;
    setIsUpdatingStatus(true);
    try {
      await updateDoc(surrogateDocRef, { status: newStatus });
      setToast({ message: 'Status updated successfully', type: 'success' });
    } catch (error) {
      console.error('Failed to update status', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate('/surrogates')}>
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
          ) : !surrogate ? (
            <Card className="p-6 text-gray-600 dark:text-gray-300">Surrogate profile not found.</Card>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-500 p-8 text-white shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.3),_transparent_65%)] opacity-80" />
                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/40 bg-white/10 text-3xl font-semibold backdrop-blur-xl">
                      {initials}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-semibold leading-tight">{displayName}</h1>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                          <i className="ri-user-heart-line text-sm"></i>
                          Surrogate
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-white/80">
                        Compassionate partner ready to support intended parents throughout the journey.
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
                        <i className="ri-donut-chart-line text-base text-white/90"></i>
                        <span className="font-medium mr-1">Status:</span>
                        <select
                          value={surrogate.status || 'Available'}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          disabled={isUpdatingStatus}
                          className="bg-transparent border-none text-white focus:ring-0 cursor-pointer py-0 pl-0 pr-8 font-semibold [&>option]:text-gray-900 [&>option]:bg-white"
                        >
                          {SURROGATE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                     </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                      <i className="ri-hashtag text-base text-white/90"></i>
                      ID: {surrogate.id}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                      <i className="ri-time-line text-base text-white/90"></i>
                      Joined: {createdAtText}
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
                    description="Update the surrogate’s headline details such as role and completion flags."
                    data={coreProfileData}
                    emptyMessage="No core profile data available."
                    templateData={CORE_PROFILE_TEMPLATE}
                    onSave={handleUpdateCore}
                  />
                </Card>
                <Card>
                  <EditableJsonSection
                    title="Form 1 Responses"
                    description="Update the initial intake form shared by the surrogate."
                    data={(surrogate.formData as Record<string, unknown>) ?? null}
                    emptyMessage="No form data available."
                    templateData={FORM_CONTACT_TEMPLATE}
                    onSave={(value) => handleUpdateField('formData', value)}
                  />
                </Card>
                <Card>
                  <EditableJsonSection
                    title="Form 2 Responses"
                    description="Modify detailed screening information."
                    data={(surrogate.form2 as Record<string, unknown>) ?? null}
                    emptyMessage="Form 2 has not been completed."
                    templateData={SURROGATE_FORM2_TEMPLATE}
                    onSave={(value) => handleUpdateField('form2', value)}
                  />
                </Card>
                <Card className="xl:col-span-2">
                  <EditableJsonSection
                    title="Additional Profile Data"
                    description="Capture any supplementary information stored alongside the surrogate profile."
                    data={(surrogate.form2Data as Record<string, unknown>) ?? null}
                    emptyMessage="No additional data provided."
                    templateData={SURROGATE_ADDITIONAL_TEMPLATE}
                    onSave={(value) => handleUpdateField('form2Data', value)}
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

export default SurrogateProfilePage;

