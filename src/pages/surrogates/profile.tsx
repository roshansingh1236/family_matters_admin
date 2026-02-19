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
import Toast from '../../components/base/Toast';
import Badge from '../../components/base/Badge';
import { storageService, STORAGE_BUCKETS } from '../../services/storageService';
import { medicalService, type MedicalRecord, type Medication } from '../../services/medicalService';
import { paymentService } from '../../services/paymentService';
import type { Payment } from '../../types';
import {
  CORE_PROFILE_TEMPLATE,
  FORM_CONTACT_TEMPLATE,
  SURROGATE_FORM2_TEMPLATE,
  SURROGATE_ADDITIONAL_TEMPLATE,
  SURROGATE_MEDICAL_FITNESS_TEMPLATE,
  SURROGATE_INFECTIOUS_DISEASE_TEMPLATE,
  SURROGATE_PSYCH_CLEARANCE_TEMPLATE,
  ABOUT_SURROGATE_TEMPLATE
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
  documents?: FileRecord[];
  profileImageUrl?: string;
  about?: Record<string, unknown>;
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

const TABS = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'about', label: 'About', icon: 'ri-information-line' },
    { id: 'personal', label: 'Personal & Intake', icon: 'ri-user-line' },
    { id: 'medical_intake', label: 'Medical Intake', icon: 'ri-file-shield-line' },
    { id: 'clinical', label: 'Clinical Care', icon: 'ri-stethoscope-line' },
    { id: 'compensation', label: 'Compensation', icon: 'ri-money-dollar-circle-line' },
    { id: 'documents', label: 'Documents', icon: 'ri-folder-open-line' }
] as const;

const SurrogateProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [surrogate, setSurrogate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Clinical & Finance State
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const fetchSurrogate = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      setSurrogate(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load surrogate profile', err);
      setError('Unable to load surrogate profile. Please try again later.');
      setSurrogate(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError('No surrogate id provided.');
      setIsLoading(false);
      return;
    }

    fetchSurrogate();

    // Setup real-time subscription
    const channel = supabase
      .channel(`surrogate-profile-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${id}`
        },
        (payload) => {
          setSurrogate(payload.new);
        }
      )
      .subscribe();

    // Fetch Clinical & Payment Data
    const loadAdditionalData = async () => {
        try {
            const [recs, meds, pays] = await Promise.all([
                medicalService.getRecordsBySurrogateId(id),
                medicalService.getMedicationsBySurrogateId(id),
                paymentService.getPaymentsBySurrogateId(id)
            ]);
            setMedicalRecords(recs);
            setMedications(meds);
            setPayments(pays);
        } catch (e) {
            console.error("Failed to load clinical/financial data", e);
        }
    };
    loadAdditionalData();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchSurrogate]);

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
      .map((part: string) => part[0]?.toUpperCase() ?? '')
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
      if (!id) return;

      let updatePayload: Record<string, any> = {};

      if (field.includes('.')) {
          const [topLevel, nested] = field.split('.');
          const currentTopLevel = (surrogate as any)?.[topLevel] || {};
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
        setSurrogate((prev: any) => ({
            ...prev,
            ...updatePayload
        }));
        setToast({ message: `${field} updated successfully`, type: 'success' });
      }
    },
    [id, surrogate]
  );

  const handleUpdateCore = useCallback(
    async (value: Record<string, unknown>) => {
      if (!id) return;
      const filteredValue = Object.keys(value).reduce<Record<string, unknown>>((acc, key) => {
        if (SURROGATE_CORE_FIELDS.includes(key as (typeof SURROGATE_CORE_FIELDS)[number])) {
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
        setSurrogate((prev: any) => ({
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

    const aboutData = useMemo(() => {
    if (!surrogate) return null;
    const about = (surrogate.about as Record<string, unknown>) ?? {};
    const formData = (surrogate.formData as Record<string, unknown>) ?? {};
    // Based on user dump, formData contains a nested form2 object with rich data
    const nestedForm2 = (formData.form2 as Record<string, unknown>) ?? {};

    // Helper to find first non-empty value
    const getValue = (...args: any[]) => args.find(v => v !== undefined && v !== null && v !== '');

    const age = getValue(about.age, surrogate.age, formData.age, nestedForm2.age);
    
    // Calculate Age Fallback if not explicitly set
    let calculatedAge = '';
    if (!age && formData.dateOfBirth) {
        try {
            const dob = new Date(formData.dateOfBirth as string);
            if (!isNaN(dob.getTime())) {
                const diff = Date.now() - dob.getTime();
                const ageDate = new Date(diff);
                calculatedAge = String(Math.abs(ageDate.getUTCFullYear() - 1970));
            }
        } catch (e) {
            console.error("Error calculating age", e);
        }
    }

    const height = getValue(about.height, surrogate.height, formData.height, nestedForm2.height);

    // Map additional fields with nested form2 fallbacks
    // Priority: About (Manual) -> Root -> FormData (Direct) -> Nested Form2 (Deep)
    const education = getValue(about.education, surrogate.education, formData.educationLevel, nestedForm2.educationLevel, formData['Education Level']);
    const occupation = getValue(about.occupation, surrogate.occupation, formData.occupation, nestedForm2.occupation, formData['Occupation']);
    
    const bioMotherHeritage = getValue(about.bioMotherHeritage, surrogate.bioMotherHeritage, formData.ethnicity, nestedForm2.ethnicity, formData['Ethnicity']);
    const bioFatherHeritage = getValue(about.bioFatherHeritage, surrogate.bioFatherHeritage);
    
    const relationshipPreference = getValue(about.relationshipPreference, surrogate.relationshipPreference, formData.relationshipStatus, nestedForm2.relationshipStatus, formData['Relationship Status']);
    
    const amhStatus = getValue(about.amhStatus, surrogate.amhStatus);
    const opennessToSecondCycle = getValue(about.opennessToSecondCycle, surrogate.opennessToSecondCycle);

    // Message to parents / About Me / Bio
    const bio = getValue(
        about.bio, 
        surrogate.bio, // Root bio from mobile app
        formData.messageToParents, 
        nestedForm2.messageToParents, 
        formData['Message To Parents'], 
        formData.surrogacyReasons, 
        nestedForm2.surrogacyReasons,
        formData['Surrogacy Reasons']
    );

    return {
        ...ABOUT_SURROGATE_TEMPLATE,
        ...about,
        age: age ? String(age) : calculatedAge,
        height: height ? String(height) : '',
        education: education || '',
        occupation: occupation || '',
        bioMotherHeritage: bioMotherHeritage || '', 
        bioFatherHeritage: bioFatherHeritage || '',
        relationshipPreference: relationshipPreference || '',
        amhStatus: amhStatus || '',
        opennessToSecondCycle: opennessToSecondCycle || '',
        bio: bio || ''
    };
  }, [surrogate]);

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
  
  const getPaymentStatusColor = (status: string) => {
    switch(status) {
        case 'Paid': return 'green';
        case 'Pending': return 'yellow';
        case 'Overdue': return 'red';
        default: return 'gray';
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
                    <div className="relative group">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/40 bg-white/10 text-3xl font-semibold backdrop-blur-xl overflow-hidden">
                        {surrogate.profileImageUrl ? (
                            <img 
                                src={surrogate.profileImageUrl} 
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

                {activeTab === 'about' && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                        {/* Left Column - Staggered Photo Grid */}
                        <div className="xl:col-span-5 space-y-4">
                            <div className="columns-1 gap-4 sm:columns-2 space-y-4">
                                {surrogate.profileImageUrl && (
                                    <div className="break-inside-avoid overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-md">
                                        <img
                                            src={surrogate.profileImageUrl}
                                            alt={displayName}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                )}
                                
                                {surrogate.documents
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

                                 {(!surrogate.profileImageUrl && (!surrogate.documents || !surrogate.documents.some((d: any) => d.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name)))) && (
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
                                    title={`About ${surrogate.firstName || 'Surrogate'}`}
                                    data={aboutData}
                                    type="surrogate"
                                    templateData={ABOUT_SURROGATE_TEMPLATE}
                                    onSave={(value) => handleUpdateField('about', value)}
                                />
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'personal' && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
                    </div>
                )}

                {activeTab === 'medical_intake' && (
                     <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <Card className="xl:col-span-2">
                            <EditableJsonSection
                                title="Comprehensive Medical Fitness Certificate"
                                description="Gynecological exam, obstetric history, BMI, BP, and general health clearance."
                                data={((surrogate.form2 as Record<string, unknown>)?.medicalFitness as Record<string, unknown>) ?? null}
                                emptyMessage="No medical fitness report available."
                                templateData={SURROGATE_MEDICAL_FITNESS_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2.medicalFitness', value)}
                            />
                        </Card>
                        <Card>
                            <EditableJsonSection
                                title="Infectious Disease Screening Report"
                                description="Screening results for HIV, HBsAg, HCV, VDRL, TORCH."
                                data={((surrogate.form2 as Record<string, unknown>)?.infectiousDisease as Record<string, unknown>) ?? null}
                                emptyMessage="No screening report available."
                                templateData={SURROGATE_INFECTIOUS_DISEASE_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2.infectiousDisease', value)}
                            />
                        </Card>
                        <Card>
                            <EditableJsonSection
                                title="Psychological / Mental Health Clearance"
                                description="Upload evaluation by certified psychologist/psychiatrist."
                                data={((surrogate.form2 as Record<string, unknown>)?.psychClearance as Record<string, unknown>) ?? null}
                                emptyMessage="No psychological clearance available."
                                templateData={SURROGATE_PSYCH_CLEARANCE_TEMPLATE}
                                onSave={(value) => handleUpdateField('form2.psychClearance', value)}
                            />
                        </Card>
                    </div>
                )}
                
                {activeTab === 'clinical' && (
                    <div className="grid grid-cols-1 gap-6">
                        <Card>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Medications</h3>
                                <Button size="sm" onClick={() => navigate('/medical')}>Manage Meds</Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Name</th>
                                            <th className="px-4 py-3">Dosage</th>
                                            <th className="px-4 py-3">Frequency</th>
                                            <th className="px-4 py-3">Start Date</th>
                                            <th className="px-4 py-3 rounded-r-lg">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {medications.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    No medications found.
                                                </td>
                                            </tr>
                                        ) : (
                                            medications.map((med) => (
                                                <tr key={med.id}>
                                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{med.name}</td>
                                                    <td className="px-4 py-3 dark:text-gray-300">{med.dosage}</td>
                                                    <td className="px-4 py-3 dark:text-gray-300">{med.frequency}</td>
                                                    <td className="px-4 py-3 dark:text-gray-300">{med.startDate}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                            med.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {med.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        <Card>
                             <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Medical Records</h3>
                                <Button size="sm" onClick={() => navigate('/medical')}>View All Records</Button>
                            </div>
                            <div className="space-y-4">
                                {medicalRecords.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8">No medical records found.</div>
                                ) : (
                                    medicalRecords.map((rec) => (
                                        <div key={rec.id} className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                            <div className="flex gap-3">
                                                <div className="mt-1">
                                                    <i className="ri-file-list-3-line text-xl text-blue-500"></i>
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-gray-900 dark:text-white">{rec.title}</h4>
                                                    <p className="text-xs text-gray-500 mt-1">{rec.date} • {rec.type}</p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{rec.summary}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                 <Badge color={rec.status === 'Verified' ? 'green' : 'yellow'}>{rec.status}</Badge>
                                                 {rec.sharedWithParents && <span className="text-xs text-green-600 flex items-center gap-1"><i className="ri-eye-line"></i> Shared</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'compensation' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-none">
                                <div className="text-green-100 mb-1">Total Paid</div>
                                <div className="text-2xl font-bold">
                                    ${payments.filter(p => p.status === 'Paid').reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}
                                </div>
                            </Card>
                             <Card className="bg-white dark:bg-gray-800">
                                <div className="text-gray-500 dark:text-gray-400 mb-1">Pending Approval</div>
                                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                                    ${payments.filter(p => p.status === 'Pending').reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}
                                </div>
                            </Card>
                             <Card className="bg-white dark:bg-gray-800">
                                <div className="text-gray-500 dark:text-gray-400 mb-1">Next Payment</div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                                    {payments.filter(p => p.status === 'Scheduled').sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate || '—'}
                                </div>
                            </Card>
                        </div>

                        <Card>
                             <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment History</h3>
                                <Button size="sm" onClick={() => navigate('/payments')}>Manage Payments</Button>
                            </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Type</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Due Date</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 rounded-r-lg">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {payments.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    No payments found.
                                                </td>
                                            </tr>
                                        ) : (
                                            payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.type}</td>
                                                    <td className="px-4 py-3 font-mono font-medium">${Number(p.amount).toLocaleString()}</td>
                                                    <td className="px-4 py-3 dark:text-gray-300">{p.dueDate}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge color={getPaymentStatusColor(p.status)}>{p.status}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{p.notes}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'documents' && (
                     <div className="grid grid-cols-1 gap-6">
                        <Card>
                            <FileUploadSection
                                title="Documents & Media"
                                description="Upload legal contracts, receipts, medical reports, and other documents."
                                userId={surrogate.id}
                                files={surrogate.documents ?? []}
                                onFilesChange={(files) => handleUpdateField('documents', files as unknown as Record<string, unknown>)}
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

export default SurrogateProfilePage;
