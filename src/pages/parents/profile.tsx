import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import EditableJsonSection from '../../components/data/EditableJsonSection';
import AboutSection from '../../components/feature/AboutSection';
import FileUploadSection, { type FileRecord } from '../../components/data/FileUploadSection';
import { storageService, STORAGE_BUCKETS } from '../../services/storageService';
import Toast from '../../components/base/Toast';
import {
  CORE_PROFILE_TEMPLATE,
  FORM_CONTACT_TEMPLATE,
  PARENT_FORM2_TEMPLATE,
  FERTILITY_TEMPLATE,
  PARENT_PROFILE_TEMPLATE,
  SURROGATE_PREFERENCES_TEMPLATE,
  IP_FERTILITY_REPORT_TEMPLATE,
  IP_INFECTIOUS_DISEASE_TEMPLATE,
  IP_EMBRYO_RECORDS_TEMPLATE,
  ABOUT_PARENT_TEMPLATE
} from '../../constants/jsonTemplates';

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
  status?: string;
  documents?: FileRecord[];
  profileImageUrl?: string;
  about?: Record<string, unknown>;
} | null;

const PARENT_STATUSES = [
  'To be Matched',
  'Matched',
  'Rematch'
] as const;

const TABS = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'about', label: 'About', icon: 'ri-information-line' },
    { id: 'personal', label: 'Personal', icon: 'ri-user-line' },
    { id: 'medical', label: 'Medical & Fertility', icon: 'ri-stethoscope-line' },
    { id: 'intake', label: 'Intake & Preferences', icon: 'ri-file-list-3-line' },
    { id: 'documents', label: 'Documents', icon: 'ri-folder-open-line' }
] as const;

const ParentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [parent, setParent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchParent = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      setParent(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load parent profile', err);
      setError('Unable to load parent profile. Please try again later.');
      setParent(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError('No parent id provided.');
      setIsLoading(false);
      return;
    }

    fetchParent();

    // Setup real-time subscription
    const channel = supabase
      .channel(`profile-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${id}`
        },
        (payload) => {
          setParent(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchParent]);

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
      .map((part: string) => part[0]?.toUpperCase() ?? '')
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
      if (!id) return;
      
      let updatePayload: Record<string, any> = {};

      if (field.includes('.')) {
          const [topLevel, nested] = field.split('.');
          const currentTopLevel = (parent as any)?.[topLevel] || {};
          updatePayload = {
              [topLevel]: {
                  ...currentTopLevel,
                  [nested]: value
              }
          };
      } else {
          updatePayload = { [field]: value };
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error(`Failed to update ${field}`, updateError);
        setToast({ message: `Failed to update ${field}`, type: 'error' });
      } else {
        // Immediate local reflection
        setParent((prev: any) => ({
            ...prev,
            ...updatePayload
        }));
        setToast({ message: `${field} updated successfully`, type: 'success' });
      }
    },
    [id, parent]
  );

  const handleUpdateCore = useCallback(
    async (value: Record<string, unknown>) => {
      if (!id) return;
      const filteredValue = Object.keys(value).reduce<Record<string, unknown>>((acc, key) => {
        if (PARENT_CORE_FIELDS.includes(key as (typeof PARENT_CORE_FIELDS)[number])) {
          acc[key] = value[key];
        }
        return acc;
      }, {});

      if (Object.keys(filteredValue).length === 0) return;
      
      const { error: updateError } = await supabase
        .from('users')
        .update(filteredValue)
        .eq('id', id);

      if (updateError) {
        console.error('Failed to update core profile', updateError);
        setToast({ message: 'Failed to update core profile', type: 'error' });
      } else {
        // Immediate local reflection
        setParent((prev: any) => ({
            ...prev,
            ...filteredValue
        }));
        setToast({ message: 'Core profile updated successfully', type: 'success' });
      }
    },
    [id]
  );
  
  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    setIsUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', id);

      if (updateError) throw updateError;
      setToast({ message: 'Status updated successfully', type: 'success' });
    } catch (error) {
      console.error('Failed to update status', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    if (!file.type.startsWith('image/')) {
        setToast({ message: 'Please upload an image file', type: 'error' });
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        setToast({ message: 'File size must be less than 5MB', type: 'error' });
        return;
    }

    try {
      setIsUploadingImage(true);
      const storagePath = `${id}/profile/avatar_${Date.now()}_${file.name}`;
      
      const { url } = await storageService.uploadFile(STORAGE_BUCKETS.USERS, storagePath, file);

      const { error: updateError } = await supabase
        .from('users')
        .update({ profileImageUrl: url })
        .eq('id', id);

      if (updateError) throw updateError;

      setToast({ message: 'Profile picture updated successfully', type: 'success' });
    } catch (error) {
      console.error('Error uploading image:', error);
      setToast({ message: 'Failed to upload profile picture', type: 'error' });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
    }
  };

  const aboutData = useMemo(() => {
    if (!parent) return null;
    const about = (parent.about as Record<string, unknown>) ?? {};
    const formData = (parent.formData as Record<string, unknown>) ?? {};
    const form2Data = (parent.form2Data as Record<string, unknown>) ?? {};
    const parent1 = (parent.parent1 as Record<string, unknown>) ?? {};
    const parent2 = (parent.parent2 as Record<string, unknown>) ?? {};

    // Helper to find first non-empty value
    const getValue = (...args: any[]) => args.find(v => v !== undefined && v !== null && v !== '');

    // Map fields
    const bio = getValue(
        about.bio,
        parent.bio,
        [(form2Data?.parent1 as any)?.aboutYourself, (form2Data?.parent2 as any)?.aboutYourself].filter(Boolean).join('\n\n'),
        (parent1 as any)?.aboutYourself
    );

    const aboutUs = getValue(
        about.aboutUs,
        formData.message,
        formData.whySurrogate,
        (form2Data?.surrogateRelated as any)?.additionalInfoForSurrogate,
        formData.messageToSurrogate,
        form2Data.familyDescription
    );

    const relationshipPreference = getValue(
        about.relationshipPreference,
        parent.relationshipPreference,
        (form2Data?.surrogateRelated as any)?.pregnancyRelationship,
        formData.relationshipType
    );

    const occupation = getValue(
        about.occupation,
        parent.occupation,
        [(form2Data?.parent1 as any)?.occupation, (form2Data?.parent2 as any)?.occupation].filter(Boolean).join(' & '),
        [parent1.occupation, parent2.occupation].filter(Boolean).join(' & ')
    );
    
    const education = getValue(
        about.education,
        parent.education,
        [(form2Data?.parent1 as any)?.education, (form2Data?.parent2 as any)?.education].filter(Boolean).join(' & '),
        [parent1.education, parent2.education].filter(Boolean).join(' & ')
    );

    const hobbies = getValue(
        about.hobbies,
        [(form2Data?.parent1 as any)?.hobbiesInterests, (form2Data?.parent2 as any)?.hobbiesInterests].filter(Boolean).join(', ')
    );

    const religion = getValue(
        about.religion,
        [(form2Data?.parent1 as any)?.religion, (form2Data?.parent2 as any)?.religion].filter(Boolean).join(' & ')
    );

    const familyLifestyle = getValue(
        about.familyLifestyle,
        [(form2Data?.parent1 as any)?.personalityDescription, (form2Data?.parent2 as any)?.personalityDescription].filter(Boolean).join('\n\n')
    );

    // Calculate Age helper
    const calculateAge = (dob: string | undefined) => {
        if (!dob) return '';
        try {
            const date = new Date(dob);
            if (isNaN(date.getTime())) return '';
            const ageDifMs = Date.now() - date.getTime();
            const ageDate = new Date(ageDifMs);
            return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
        } catch { return ''; }
    };

    const p1Age = (parent1 as any)?.age || calculateAge((parent1 as any)?.dob) || calculateAge((form2Data?.parent1 as any)?.dob);
    const p2Age = (parent2 as any)?.age || calculateAge((parent2 as any)?.dob) || calculateAge((form2Data?.parent2 as any)?.dob);
    
    const age = getValue(
        about.age,
        parent.age,
        (formData as any)?.age,
        [p1Age, p2Age].filter(a => a && a !== '0').join(' & ')
    );

    return {
        ...ABOUT_PARENT_TEMPLATE,
        ...about,
        bio: bio || '',
        age: age || '',
        aboutUs: aboutUs || '',
        relationshipPreference: relationshipPreference || '',
        occupation: occupation || '',
        education: education || '',
        hobbies: hobbies || '',
        religion: religion || '',
        familyLifestyle: familyLifestyle || ''
    };
  }, [parent]);

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
                    <div className="relative group">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-3xl font-semibold backdrop-blur-xl overflow-hidden">
                        {parent.profileImageUrl ? (
                            <img 
                                src={parent.profileImageUrl} 
                                alt={displayName} 
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            initials
                        )}
                        </div>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingImage}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                            title="Change profile picture"
                        >
                            {isUploadingImage ? (
                                <i className="ri-loader-4-line animate-spin text-white text-xl"></i>
                            ) : (
                                <i className="ri-camera-line text-white text-xl"></i>
                            )}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/*"
                            className="hidden"
                        />
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
                        <i className="ri-donut-chart-line text-base text-white/90"></i>
                         <span className="font-medium mr-1">Status:</span>
                        <select
                          value={parent.status || 'To be Matched'}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          disabled={isUpdatingStatus}
                          className="bg-transparent border-none text-white focus:ring-0 cursor-pointer py-0 pl-0 pr-8 font-semibold [&>option]:text-gray-900 [&>option]:bg-white"
                        >
                          {PARENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                     </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                      <i className="ri-hashtag text-base text-white/90"></i>
                      ID: {parent.id}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 no-scrollbar">
                  {TABS.map((tab) => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`
                            flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                            ${activeTab === tab.id 
                                ? 'border-primary-500 text-primary-600 dark:border-primary-400 dark:text-primary-400' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }
                        `}
                      >
                          <i className={tab.icon}></i>
                          {tab.label}
                      </button>
                  ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-6">
                {activeTab === 'overview' && (
                    <>
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
                        <div className="grid grid-cols-1 gap-6">
                             <Card className="xl:col-span-2">
                                <EditableJsonSection
                                    title="Core Profile"
                                    description="Update top-level information such as role and completion status."
                                    data={coreProfileData}
                                    emptyMessage="No core profile data available."
                                    templateData={CORE_PROFILE_TEMPLATE}
                                    onSave={handleUpdateCore}
                                />
                            </Card>
                        </div>
                    </>
                )}

                {activeTab === 'about' && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                        {/* Left Column - Staggered Photo Grid */}
                        <div className="xl:col-span-5 space-y-4">
                            <div className="columns-1 gap-4 sm:columns-2 space-y-4">
                                {/* Profile Image */}
                                {parent.profileImageUrl && (
                                    <div className="break-inside-avoid overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-md">
                                        <img
                                            src={parent.profileImageUrl}
                                            alt={displayName}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                )}
                                
                                {/* Additional Images from Documents */}
                                {parent.documents
                                    ?.filter((doc: any) => {
                                        const isImage = doc.type?.startsWith('image/');
                                        const hasImageExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);
                                        const isMissingType = !doc.type;
                                        return isImage || hasImageExt || (isMissingType && hasImageExt);
                                    })
                                    .map((doc: any, index: number) => (
                                        <div key={`${doc.url}-${index}`} className="break-inside-avoid overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-md group relative">
                                            <img
                                                src={doc.url}
                                                alt={doc.name}
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                                        </div>
                                    ))
                                }

                                {!parent.profileImageUrl && (!parent.documents || !parent.documents.some((d: any) => d.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name))) && (
                                     <div className="break-inside-avoid flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 text-4xl text-gray-300 dark:text-gray-600">
                                        <i className="ri-image-line"></i>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - About Info */}
                        <div className="xl:col-span-7 space-y-6">
                            <Card>
                                <AboutSection
                                    title={`About ${displayName}`}
                                    data={aboutData}
                                    type="parent"
                                    templateData={ABOUT_PARENT_TEMPLATE}
                                    onSave={(value: any) => handleUpdateField('about', value)}
                                />
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'personal' && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <Card>
                            <EditableJsonSection
                                title="Parent 1"
                                description="Edit details for Parent 1."
                                data={(parent.parent1 as Record<string, unknown>) ?? null}
                                emptyMessage="Parent 1 details not provided."
                                templateData={PARENT_PROFILE_TEMPLATE}
                                onSave={(value) => handleUpdateField('parent1', value)}
                            />
                        </Card>
                        <Card>
                            <EditableJsonSection
                                title="Parent 2"
                                description="Edit details for Parent 2."
                                data={(parent.parent2 as Record<string, unknown>) ?? null}
                                emptyMessage="Parent 2 details not provided."
                                templateData={PARENT_PROFILE_TEMPLATE}
                                onSave={(value) => handleUpdateField('parent2', value)}
                            />
                        </Card>
                    </div>
                )}

                {activeTab === 'medical' && (
                     <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <Card className="xl:col-span-2">
                            <EditableJsonSection
                                title="Fertility Information"
                                description="Capture fertility clinic, embryo and related details."
                                data={((parent.form2Data as Record<string, unknown>)?.fertility as Record<string, unknown>) ?? null}
                                emptyMessage="No fertility information provided."
                                templateData={FERTILITY_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2Data.fertility', value)}
                            />
                        </Card>
                         <Card className="xl:col-span-2">
                            <EditableJsonSection
                                title="Fertility & Reproductive Health Report"
                                description="IVF evaluation, ovarian reserve, and diagnosis."
                                data={((parent.form2Data as Record<string, unknown>)?.fertilityReport as Record<string, unknown>) ?? null}
                                emptyMessage="No fertility report available."
                                templateData={IP_FERTILITY_REPORT_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2Data.fertilityReport', value)}
                            />
                        </Card>
                        <Card>
                            <EditableJsonSection
                                title="Infectious Disease Screening Report"
                                description="Screening results for HIV, HBsAg, HCV, VDRL, CMV."
                                data={((parent.form2Data as Record<string, unknown>)?.infectiousDisease as Record<string, unknown>) ?? null}
                                emptyMessage="No screening report available."
                                templateData={IP_INFECTIOUS_DISEASE_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2Data.infectiousDisease', value)}
                            />
                        </Card>
                        <Card>
                            <EditableJsonSection
                                title="Embryo / Gamete Medical Records"
                                description="Embryo freezing and donor screening reports."
                                data={((parent.form2Data as Record<string, unknown>)?.embryoRecords as Record<string, unknown>) ?? null}
                                emptyMessage="No embryo records available."
                                templateData={IP_EMBRYO_RECORDS_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2Data.embryoRecords', value)}
                            />
                        </Card>
                    </div>
                )}

                {activeTab === 'intake' && (
                     <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                         <Card>
                            <EditableJsonSection
                                title="Form 1 Responses"
                                description="Update the intake details shared by the intended parents."
                                data={(parent.formData as Record<string, unknown>) ?? null}
                                emptyMessage="No form data available."
                                templateData={FORM_CONTACT_TEMPLATE}
                                onSave={(value) => handleUpdateField('formData', value)}
                            />
                        </Card>
                        <Card>
                            <EditableJsonSection
                                title="Form 2 Responses"
                                description="Modify the extended questionnaire answers for this family."
                                data={(parent.form2Data as Record<string, unknown>) ?? null}
                                emptyMessage="Form 2 has not been completed."
                                templateData={PARENT_FORM2_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2Data', value)}
                            />
                        </Card>
                        <Card className="xl:col-span-2">
                            <EditableJsonSection
                                title="Surrogate Preferences"
                                description="Fine-tune the family's preferences for potential surrogates."
                                data={(parent.surrogateRelated as Record<string, unknown>) ?? null}
                                emptyMessage="No surrogate preferences captured."
                                templateData={SURROGATE_PREFERENCES_TEMPLATE}
                                onSave={(value) => handleUpdateField('surrogateRelated', value)}
                            />
                        </Card>
                     </div>
                )}
                
                {activeTab === 'documents' && (
                    <div className="grid grid-cols-1 gap-6">
                         <Card>
                            <FileUploadSection
                                title="Documents & Media"
                                description="Upload legal contracts, receipts, medical reports, and other documents."
                                userId={parent.id}
                                files={parent.documents ?? []}
                                onFilesChange={(files: any[]) => handleUpdateField('documents', files as unknown as Record<string, unknown>)}
                            />
                        </Card>
                    </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ParentProfilePage;

