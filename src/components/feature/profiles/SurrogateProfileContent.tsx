import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import Card from '../../base/Card';
import Button from '../../base/Button';
import EditableJsonSection from '../../data/EditableJsonSection';
import SurrogateIntakeFormView from '../../data/SurrogateIntakeFormView';
import CoreProfileCard from '../../data/CoreProfileCard';
import AboutSection from '../AboutSection';
import FileUploadSection from '../../data/FileUploadSection';
import Toast from '../../base/Toast';
import Badge from '../../base/Badge';
import { storageService, STORAGE_BUCKETS } from '../../../services/storageService';
import { medicalService, type Medication } from '../../../services/medicalService';
import { paymentService } from '../../../services/paymentService';
import { screeningService } from '../../../services/screeningService';
import { auditService } from '../../../services/auditService';
import type { Payment, MedicalRecordRequest, MedicalRecordRequestStatus, ReceivedFile, HipaaAuthStatus } from '../../../types';
import {
  SURROGATE_INTAKE_TEMPLATE,
  SURROGATE_ADDITIONAL_TEMPLATE,
  ABOUT_SURROGATE_TEMPLATE,
  INITIAL_APPLICATION_TEMPLATE
} from '../../../constants/jsonTemplates';

import CreateMatchDialog from '../CreateMatchDialog';
import AgencyApprovalToggle from '../AgencyApprovalToggle';
import MedicalReportView from '../MedicalReportView';
import { GC_STATUSES, GC_MEDICAL_SCREENING_STATUSES } from '../../../types';
import {
  resolveSurrogateAdditionalProfile,
  resolveSurrogateIntakeProfile
} from '../../../utils/surrogateFormData';
import { medicalIntakeProfileSource } from '../../../utils/surrogateMedicalFromProfile';
import { normalizeUserDocuments } from '../../../utils/userDocuments';
import SurrogateMedicalIntakeView from '../../data/SurrogateMedicalIntakeView';
import { JourneyRoadmap } from '../JourneyRoadmap';
import ReimbursementTracker from '../ReimbursementTracker';

interface SurrogateProfileContentProps {
  id: string;
  onClose?: () => void;
  showBackButton?: boolean;
  showCreateMatch?: boolean;
}

const SURROGATE_CORE_FIELDS = ['firstName', 'lastName', 'role', 'profileCompleted', 'form2Completed', 'profileCompletedAt', 'form2CompletedAt'] as const;

/** Merge DB snake_case, legacy camelCase, and form_data (Flutter) into UI firstName/lastName. */
function surrogateStateFromRow(data: Record<string, any>) {
  const resolveJson = (v: any) => {
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch (e) { return v; }
    }
    return v;
  };

  const colFd = resolveJson(data.form_data ?? data.formData ?? {});
  const getNested = (obj: any) => (obj && typeof obj === 'object' && obj.form_data && typeof obj.form_data === 'object' && !Array.isArray(obj.form_data)) ? obj.form_data : null;
  const fd = { ...colFd, ...(getNested(colFd) || {}) };

  const intake = resolveSurrogateIntakeProfile(fd, data);
  const additional = resolveSurrogateAdditionalProfile(fd, data);
  const firstName = data.first_name ?? data.firstName ?? fd.firstName ?? fd.first_name;
  const lastName = data.last_name ?? data.lastName ?? fd.lastName ?? fd.last_name;
  const profileCompletedAt = data.profile_completed_at ?? data.profileCompletedAt ?? fd.profileCompletedAt ?? fd.profile_completed_at ?? '';
  const form2CompletedAt = data.form_2_completed_at ?? data.form2_completed_at ?? data.form2CompletedAt ?? fd.form2CompletedAt ?? fd.form_2_completed_at ?? '';

  return {
    ...data,
    documents: normalizeUserDocuments(data.documents),
    firstName: firstName ?? data.firstName,
    lastName: lastName ?? data.lastName,
    profileCompletedAt,
    form2CompletedAt,
    profileImageUrl: data.profile_image_url ?? data.profileImageUrl,
    formData: fd,
    form1: intake,
    form2: additional,
    form2Completed: data.form_2_completed ?? data.form2Completed ?? false,
    profileCompleted: data.profile_completed ?? data.profileCompleted ?? false,
  };
}

const TABS = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'workflow', label: 'Workflow', icon: 'ri-task-line' },
    { id: 'gallery', label: 'Photo Gallery', icon: 'ri-image-line' },
    { id: 'application', label: 'Signup & Intake (Form 1)', icon: 'ri-file-user-line' },
    { id: 'personal', label: 'Detailed App (Form 2)', icon: 'ri-profile-line' },
    { id: 'medical_report', label: 'Medical Reports', icon: 'ri-heart-pulse-line' },
    { id: 'medical_intake', label: 'Medical Intake', icon: 'ri-file-shield-line' },
    { id: 'clinical', label: 'Clinical Care', icon: 'ri-stethoscope-line' },
    { id: 'finances', label: 'Finances & Expenses', icon: 'ri-money-dollar-circle-line' },
    { id: 'documents', label: 'Documents', icon: 'ri-folder-open-line' }
] as const;


export default function SurrogateProfileContent({ 
  id, 
  onClose, 
  showBackButton = true,
  showCreateMatch = true 
}: SurrogateProfileContentProps) {
  const navigate = useNavigate();
  const [surrogate, setSurrogate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Clinical & Finance State
  const [medications, setMedications] = useState<Medication[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Medical Record Requests State
  const [recordRequests, setRecordRequests] = useState<MedicalRecordRequest[]>([]);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [newRequest, setNewRequest] = useState<Partial<MedicalRecordRequest>>({
    status: 'Not Requested',
    authorizationOnFile: false,
    recordType: 'OB delivery records',
  });

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
      if (data) {
        setSurrogate(surrogateStateFromRow(data));
      } else {
        setSurrogate(null);
      }
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
        (payload: any) => {
          const d = payload.new;
          setSurrogate(surrogateStateFromRow(d));
        }
      )
      .subscribe();

    const loadAdditionalData = async () => {
        try {
            const [meds, pays, requests] = await Promise.all([
                medicalService.getMedicationsBySurrogateId(id),
                paymentService.getPaymentsBySurrogateId(id),
                screeningService.getRecordRequests(id),
            ]);
            setMedications(meds);
            setPayments(pays);
            setRecordRequests(requests);
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
    return String(value);
  };

  const displayName = useMemo(() => {
    if (!surrogate) return 'Surrogate Profile';
    const formFirstName = (surrogate.formData as any)?.firstName;
    const formLastName = (surrogate.formData as any)?.lastName;
    const combined = [formFirstName, formLastName].filter(Boolean).join(' ');
    if (combined.length > 0) return combined;
    const fallbackCombined = [surrogate.firstName, surrogate.lastName].filter(Boolean).join(' ');
    if (fallbackCombined.length > 0) return fallbackCombined;
    return surrogate.email ?? 'Surrogate Profile';
  }, [surrogate]);

  const initials = useMemo(() => {
    if (!displayName) return 'FM';
    return displayName.split(' ').filter(Boolean).map((p: string) => p[0]?.toUpperCase()).join('').slice(0, 2) || 'FM';
  }, [displayName]);

  const location = useMemo(() => {
    if (!surrogate) return null;
    const city = surrogate.formData?.city?.trim();
    const state = surrogate.formData?.state?.trim();
    const combined = [city, state].filter(Boolean).join(', ');
    return combined.length > 0 ? combined : null;
  }, [surrogate]);

  const phone = useMemo(() => {
    if (!surrogate) return null;
    const fd = surrogate.formData as Record<string, unknown> | undefined;
    const raw =
      fd?.phone ??
      fd?.phoneNumber ??
      fd?.phone_number ??
      surrogate.phone ??
      surrogate.phone_number ??
      surrogate.phoneNumber;
    const s = typeof raw === 'string' ? raw.trim() : '';
    return s.length > 0 ? s : null;
  }, [surrogate]);

  const availability = useMemo(() => {
    if (!surrogate) return null;
    return (surrogate.form2 as any)?.availability ?? surrogate.form2Data?.availability ?? null;
  }, [surrogate]);

  const experience = useMemo(() => {
    if (!surrogate) return null;
    const pregnancies = surrogate.form2?.pregnancyHistory?.total;
    const surrogacyChildren = surrogate.form2?.surrogacyChildren ?? surrogate.form2Data?.surrogacyChildren;
    if (pregnancies) return `${pregnancies} pregnancies`;
    if (surrogacyChildren) return `${surrogacyChildren} surrogacy journey${surrogacyChildren === '1' ? '' : 's'}`;
    return null;
  }, [surrogate]);

  const updatedAtText = useMemo(() => formatDateTime(surrogate?.updatedAt), [surrogate]);
  const createdAtText = useMemo(() => formatDateTime(surrogate?.createdAt), [surrogate]);

  const heroMeta = useMemo(() => [
    surrogate?.email && { 
      icon: 'ri-mail-line', 
      label: 'Email', 
      value: surrogate.email,
      href: `mailto:${surrogate.email}`
    },
    phone && { 
      icon: 'ri-phone-line', 
      label: 'Phone', 
      value: phone,
      href: `tel:${phone}`
    },
    location && { icon: 'ri-map-pin-line', label: 'Location', value: location },
    availability && { icon: 'ri-calendar-check-line', label: 'Availability', value: availability }
  ].filter(Boolean) as any[], [availability, location, phone, surrogate?.email]);

  // Per client review: surrogate is match-eligible when status is "Ready to Match"
  const isEligibleForMatch = useMemo(() => surrogate?.status === 'Ready to Match', [surrogate]);

  const summaryCards = useMemo(() => [
    {
      label: 'Profile Status',
      value: surrogate?.profileCompleted ? 'Ready' : 'In Progress',
      icon: surrogate?.profileCompleted ? 'ri-heart-3-line' : 'ri-time-line',
      className: surrogate?.profileCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    },
    {
      label: 'Match Eligibility',
      value: isEligibleForMatch ? 'Eligible' : 'Not Eligible',
      icon: isEligibleForMatch ? 'ri-links-line' : 'ri-lock-line',
      className: isEligibleForMatch ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
    },
    { label: 'Experience', value: experience ?? '—', icon: 'ri-user-heart-line', className: 'bg-white dark:bg-[#0e0b1a] border border-rose-100/60 dark:border-white/5 text-gray-700 dark:text-gray-200' },
    { label: 'Last Updated', value: updatedAtText, icon: 'ri-refresh-line', className: 'bg-white dark:bg-[#0e0b1a] border border-rose-100/60 dark:border-white/5 text-gray-700 dark:text-gray-200' }
  ], [experience, isEligibleForMatch, surrogate?.profileCompleted, updatedAtText]);

  const handleUpdateField = async (field: string, value: any) => {
    if (!id) return;

    const mergedFormData = () => ({ ...(surrogate.formData || surrogate.form_data || {}) });

    let updatePayload: Record<string, unknown> = {};

    if (field.startsWith('form_data.')) {
      const sub = field.slice('form_data.'.length);
      const fd = mergedFormData();
      fd[sub] = value;
      updatePayload = { form_data: fd };
    } else if (field.startsWith('form2.')) {
        const sub = field.slice('form2.'.length);
        const fd = mergedFormData();
        fd[sub] = value;
        updatePayload = { form_data: fd };
    } else if (field === 'form2_data') {
        updatePayload = { form2_data: value };
    } else {
      updatePayload = { [field]: value };
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setToast({ message: 'Profile updated successfully', type: 'success' });
      fetchSurrogate();
    } catch (err: any) {
      console.error('Failed to update field', err);
      setToast({ message: `Update failed: ${err.message}`, type: 'error' });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    await handleUpdateField('status', newStatus);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploadingImage(true);
    try {
      const { url, error } = await storageService.uploadProfileImage(id, file);
      if (error) throw error;
      
      await handleUpdateField('profile_image_url', url);
      setToast({ message: 'Profile picture updated', type: 'success' });
    } catch (err: any) {
      console.error('Upload error:', err);
      setToast({ message: `Upload failed: ${err.message}`, type: 'error' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'green';
      case 'pending': return 'yellow';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#0e0b1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading surrogate profile...</p>
        </div>
      </div>
    );
  }

  if (error || !surrogate) {
    return (
      <div className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto p-12 text-center border-dashed border-2">
           <i className="ri-error-warning-line text-4xl text-rose-500 mb-4"></i>
           <h3 className="text-xl font-bold text-gray-900 dark:text-white">Profile Not Found</h3>
           <p className="text-gray-500 mt-2">{error || "The surrogate profile you are looking for doesn't exist or has been removed."}</p>
           <Button className="mt-6" onClick={() => navigate('/surrogates')}>Back to Surrogates</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0e0b1a] relative no-scrollbar">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero Header */}
      <div className="relative h-64 bg-rose-500 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-600 to-rose-400 opacity-90"></div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        
        <div className="relative h-full max-w-7xl mx-auto px-6 flex items-end pb-12">
          {showBackButton && (
            <button 
              onClick={() => navigate(-1)}
              className="absolute top-6 left-6 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-md border border-white/10"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
          )}

          <div className="flex items-center gap-8 text-white w-full">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-white/20 backdrop-blur-xl border-4 border-white/30 overflow-hidden flex items-center justify-center text-4xl font-bold shadow-2xl">
                {surrogate.profileImageUrl ? (
                  <img src={surrogate.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <i className={`${isUploadingImage ? 'ri-loader-4-line animate-spin' : 'ri-camera-line'} text-2xl`}></i>
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden"/>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold leading-tight">{displayName}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  <i className="ri-user-heart-line text-sm"></i> Surrogate
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-white/90">
                {heroMeta.map((item: any) => (
                  item.href ? (
                    <a 
                      key={item.label} 
                      href={item.href}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md hover:bg-white/20 transition-all"
                    >
                      <i className={`${item.icon} text-base`}></i> <span>{item.value}</span>
                    </a>
                  ) : (
                    <span key={item.label} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">
                      <i className={`${item.icon} text-base`}></i> <span>{item.value}</span>
                    </span>
                  )
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-sm text-white/80">
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                <i className="ri-donut-chart-line text-base"></i> <span className="font-medium mr-1">Status:</span>
                <select value={surrogate.status || 'New Application'} onChange={(e) => handleStatusChange(e.target.value)} className="bg-transparent border-none text-white focus:ring-0 cursor-pointer py-0 pl-0 pr-8 font-semibold [&>option]:text-gray-900">
                  {GC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                <i className="ri-stethoscope-line text-base"></i> <span className="font-medium mr-1">Medical:</span>
                <select
                  value={surrogate.medical_screening_status ?? surrogate.medicalScreeningStatus ?? 'Not Started'}
                  onChange={async (e) => {
                    const status = e.target.value;
                    // Per spec: "Medically Cleared for Program" requires all OB records received + reviewed
                    if (status === 'Medically Cleared for Program') {
                      const { eligible, issues } = await screeningService.checkClearanceEligibility(id);
                      if (!eligible) {
                        setToast({ message: `Cannot mark Medically Cleared:\n${issues.join('\n')}`, type: 'error' });
                        return;
                      }
                    }
                    const { error } = await supabase
                      .from('users')
                      .update({ medical_screening_status: status, updated_at: new Date().toISOString() })
                      .eq('id', id);
                    if (!error) setSurrogate((prev: any) => ({ ...prev, medical_screening_status: status }));
                    else {
                      console.error('medical_screening_status update', error);
                      setToast({
                        message: error.message?.includes('check constraint')
                          ? `Database rejected this status. Run migration 20260409_users_medical_screening_status_check.sql (CHECK must allow admin values). Details: ${error.message}`
                          : `Failed to update medical status: ${error.message}`,
                        type: 'error'
                      });
                    }
                  }}
                  className="bg-transparent border-none text-white focus:ring-0 cursor-pointer py-0 pl-0 pr-8 font-semibold [&>option]:text-gray-900"
                >
                  {GC_MEDICAL_SCREENING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur"><i className="ri-hashtag text-base"></i> ID: {surrogate.id.split('-')[0]}</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#15111f] border-b border-rose-100/60 dark:border-white/5 flex overflow-x-auto no-scrollbar backdrop-blur-xl bg-opacity-80">
          {TABS.map((tab) => (
              <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-500/5' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}`}
              >
                  <i className={`${tab.icon} text-base`}></i> {tab.label}
              </button>
          ))}
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 lg:col-span-2">
                    {summaryCards.map((card) => (
                        <Card key={card.label} padding="sm" className={`${card.className} border-none shadow-sm backdrop-blur`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase opacity-70">{card.label}</p>
                                    <p className="mt-2 text-lg font-semibold">{card.value}</p>
                                </div>
                                <span className="text-xl opacity-70"><i className={card.icon}></i></span>
                            </div>
                        </Card>
                    ))}
                </div>

                <Card className="lg:col-span-1">
                    <CoreProfileCard 
                        title="Core Details" 
                        data={surrogate} 
                        fields={SURROGATE_CORE_FIELDS} 
                        onSave={(field, val) => handleUpdateField(field, val)} 
                    />
                </Card>

                <Card className="lg:col-span-1">
                   <AboutSection 
                      title="About Me" 
                      description="Bio and background story for matching."
                      data={surrogate.formData?.about_surrogate || null} 
                      templateData={ABOUT_SURROGATE_TEMPLATE}
                      onSave={(val) => handleUpdateField('form_data.about_surrogate', val)}
                   />
                </Card>

                <Card className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">Quick Contact</h3>
                        <div className="flex gap-2">
                           <Button size="sm" variant="outline" onClick={() => window.open(`mailto:${surrogate.email}`)}>Email</Button>
                           <Button size="sm" variant="outline" onClick={() => window.open(`tel:${phone}`)}>Call</Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-white/5 border border-rose-100/50 dark:border-white/5">
                            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Email</p>
                            <p className="text-gray-900 dark:text-white font-medium break-all">{surrogate.email}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-white/5 border border-rose-100/50 dark:border-white/5">
                            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Phone</p>
                            <p className="text-gray-900 dark:text-white font-medium">{phone || '—'}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-white/5 border border-rose-100/50 dark:border-white/5">
                            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Joined</p>
                            <p className="text-gray-900 dark:text-white font-medium">{createdAtText}</p>
                        </div>
                    </div>
                </Card>

                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <JourneyRoadmap role="Surrogate" currentStatus={surrogate.status} />
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none shadow-lg">
                        <div className="flex flex-col h-full justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold">Become a Surrogate</h3>
                                <p className="text-sm text-white/80 mt-2">Reading materials and resources provided to this surrogate in the app dashboard.</p>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { title: 'The Surrogacy Process', icon: 'ri-book-read-line' },
                                    { title: 'Medical Screening 101', icon: 'ri-stethoscope-line' },
                                    { title: 'Understanding Legal Steps', icon: 'ri-scales-3-line' }
                                ].map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <i className={doc.icon}></i>
                                            <span className="text-xs font-medium">{doc.title}</span>
                                        </div>
                                        <i className="ri-external-link-line opacity-50"></i>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        )}

        {activeTab === 'workflow' && (
            <Card>
                <div className="p-12 text-center border-dashed border-2">
                    <i className="ri-flow-chart text-4xl text-gray-300 mb-4"></i>
                    <h3 className="text-lg font-bold">Workflow Tracking</h3>
                    <p className="text-gray-500 mt-2">Active journey milestones and checklist coming soon.</p>
                </div>
            </Card>
        )}

        {activeTab === 'gallery' && (
            <Card>
                <div className="p-12 text-center border-dashed border-2">
                    <i className="ri-image-2-line text-4xl text-gray-300 mb-4"></i>
                    <h3 className="text-lg font-bold">Photo Gallery</h3>
                    <p className="text-gray-500 mt-2">Surrogate lifestyle and family photos will appear here.</p>
                </div>
            </Card>
        )}

        {activeTab === 'application' && (
              <div className="grid grid-cols-1 gap-6">
                  <Card>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold">Intake Questionnaire</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Hover any field and click <i className="ri-edit-line"></i> Edit to correct values (e.g. weight, height).</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateField('form_data.surrogate_profile', surrogate.form1)}>Copy to Profile</Button>
                      </div>
                      <SurrogateIntakeFormView
                        data={surrogate.form1 as Record<string, unknown> | null}
                        onSaveField={async (key, value) => {
                          // Save back into whichever container originally held the field.
                          // Priority: form_data.surrogate_profile -> top-level form_data.
                          const fd = (surrogate.formData || {}) as Record<string, any>;
                          const sp = (fd.surrogate_profile && typeof fd.surrogate_profile === 'object') ? fd.surrogate_profile : null;
                          if (sp && Object.prototype.hasOwnProperty.call(sp, key)) {
                            const next = { ...sp, [key]: value };
                            await handleUpdateField('form_data.surrogate_profile', next);
                          } else {
                            await handleUpdateField(`form_data.${key}`, value);
                          }
                        }}
                      />
                    </div>
                  </Card>
              </div>
        )}

        {activeTab === 'personal' && (
            <div className="grid grid-cols-1 gap-6 text-left">
                <Card><EditableJsonSection title="Detailed App (surrogate_profile)" data={surrogate.form2 || null} templateData={SURROGATE_INTAKE_TEMPLATE} onSave={(v: any) => handleUpdateField('form_data.surrogate_profile', v)} /></Card>
                 {(() => {
                  const d = surrogate.form1 as any;
                  if (!d) return null;
                  
                  const pregnancies: any[] = [];
                  Object.keys(d).forEach(key => {
                    const match = key.match(/^pregnancy(\d+)Name$/);
                    if (match) {
                      const n = parseInt(match[1]);
                      pregnancies.push({
                        number: n,
                        name: d[`pregnancy${n}Name`],
                        dob: d[`pregnancy${n}DOB`],
                        gender: d[`pregnancy${n}Gender`],
                        weight: d[`pregnancy${n}Weight`],
                        deliveryType: d[`pregnancy${n}Delivery`],
                        gestationalAge: d[`pregnancy${n}GestationalAge`],
                        complications: d[`pregnancy${n}Complications`],
                        obgyn: d[`pregnancy${n}OBGYN`],
                        hospital: d[`pregnancy${n}Hospital`],
                        surrogacy: d[`pregnancy${n}Surrogacy`],
                      });
                    }
                  });
                  const validPregnancies = pregnancies.sort((a, b) => a.number - b.number).filter(p => p.name || p.dob || p.obgyn || p.hospital);
                  if (validPregnancies.length === 0) return null;

                  return (
                    <Card>
                      <div className="p-4">
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">OB History Summary</h3>
                        <div className="overflow-x-auto mt-4">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-white/5 text-xs uppercase text-gray-500">
                              <tr>
                                <th className="px-3 py-2">#</th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">DOB</th>
                                <th className="px-3 py-2">Delivery</th>
                                <th className="px-3 py-2">GA</th>
                                <th className="px-3 py-2">OB/GYN</th>
                                <th className="px-3 py-2">Surrogacy?</th>
                              </tr>
                            </thead>
                            <tbody>
                              {validPregnancies.map((p, idx) => (
                                <tr key={idx} className="border-t border-gray-100 dark:border-white/5">
                                  <td className="px-3 py-2 font-semibold">{p.number}</td>
                                  <td className="px-3 py-2">{p.name || '—'}</td>
                                  <td className="px-3 py-2">{p.dob ? new Date(p.dob).toLocaleDateString() : '—'}</td>
                                  <td className="px-3 py-2">{p.deliveryType || '—'}</td>
                                  <td className="px-3 py-2">{p.gestationalAge || '—'}</td>
                                  <td className="px-3 py-2">{p.obgyn || '—'}</td>
                                  <td className="px-3 py-2">{p.surrogacy || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
            </div>
        )}

        {activeTab === 'medical_report' && (
            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <MedicalReportView userType="surrogate" data={surrogate} name={displayName} userId={surrogate.id} />
                </Card>
            </div>
        )}

        {activeTab === 'medical_intake' && (
             <div className="space-y-6">
                <SurrogateMedicalIntakeView
                  surrogate={surrogate}
                  onSaveFitness={(v) => handleUpdateField('form2.medicalFitness', v)}
                  onSaveInfectious={(v) => handleUpdateField('form2.infectiousDisease', v)}
                  onSavePsych={(v) => handleUpdateField('form2.psychClearance', v)}
                  onOpenDocumentsTab={() => setActiveTab('documents')}
                />

                {/* Medical Record Request Tracking — per spec: track per-provider requests */}
                <Card className="xl:col-span-2">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white">Medical Record Requests</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Track record retrieval from each provider/facility. Authorization must be on file before requesting.</p>
                      </div>
                      <Button size="sm" onClick={() => setShowAddRequest(v => !v)}>
                        <i className="ri-add-line mr-1"></i> Add Request
                      </Button>
                    </div>

                    {showAddRequest && (
                      <div className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 space-y-3">
                        {/* Auto-fill from OB history */}
                        {(() => {
                          const d = (medicalIntakeProfileSource(surrogate) ?? surrogate.form2) as any;
                          const obEntries = d ? [1,2,3].map(n => ({ n, provider: d[`pregnancy${n}OBGYN`], facility: d[`pregnancy${n}Hospital`] })).filter(e => e.provider || e.facility) : [];
                          if (obEntries.length === 0) return null;
                          return (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Auto-fill from OB History</label>
                              <select onChange={e => {
                                const idx = parseInt(e.target.value);
                                if (isNaN(idx)) return;
                                const entry = obEntries[idx];
                                setNewRequest(p => ({ ...p, pregnancyNumber: entry.n, providerName: entry.provider || '', facilityName: entry.facility || '' }));
                              }} className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm">
                                <option value="">— select pregnancy to auto-fill —</option>
                                {obEntries.map((e, i) => <option key={i} value={i}>Pregnancy #${e.n} – ${e.provider || e.facility}</option>)}
                              </select>
                            </div>
                          );
                        })()}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            { label: 'Provider / Practice Name', key: 'providerName', type: 'text' },
                            { label: 'Facility / Hospital', key: 'facilityName', type: 'text' },
                            { label: 'Record Type', key: 'recordType', type: 'select', options: ['OB delivery records','Prenatal records','Operative report','Lab results','Imaging','Clearance letter','Mental health documentation','Other'] },
                            { label: 'Pregnancy #', key: 'pregnancyNumber', type: 'number' },
                            { label: 'Date Requested', key: 'dateRequested', type: 'date' },
                            { label: 'Request Method', key: 'requestMethod', type: 'select', options: ['Fax','Portal','Email','Mail'] },
                            { label: 'Follow-up Date', key: 'followUpDate', type: 'date' },
                            { label: 'Status', key: 'status', type: 'select', options: ['Not Requested','Requested','Follow-Up Needed','Received (Partial)','Received (Complete)','Unable to Obtain'] },
                            { label: 'Notes', key: 'notes', type: 'text' },
                          ].map(field => (
                            <div key={field.key}>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{field.label}</label>
                              {field.type === 'select' ? (
                                <select value={(newRequest as any)[field.key] || ''} onChange={e => setNewRequest(p => ({ ...p, [field.key]: e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm">
                                  <option value="">—</option>
                                  {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input type={field.type} value={(newRequest as any)[field.key] || ''} onChange={e => setNewRequest(p => ({ ...p, [field.key]: field.type === 'number' ? parseInt(e.target.value) : e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={newRequest.authorizationOnFile || false} onChange={e => setNewRequest(p => ({ ...p, authorizationOnFile: e.target.checked }))} className="rounded" />
                            Authorization on file
                          </label>
                          <Button size="sm" onClick={async () => {
                            if (!newRequest.providerName?.trim()) return;
                            const updated = await screeningService.saveRecordRequest(id, newRequest as any);
                            setRecordRequests(updated);
                            setShowAddRequest(false);
                            setNewRequest({ status: 'Not Requested', authorizationOnFile: false, recordType: 'OB delivery records' });
                          }}>Save Request</Button>
                        </div>
                      </div>
                    )}

                    {recordRequests.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No record requests yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {recordRequests.map(req => {
                          const statusColor: any = {
                            'Received (Complete)': 'green',
                            'Received (Partial)': 'yellow',
                            'Requested': 'blue',
                            'Follow-Up Needed': 'yellow',
                            'Unable to Obtain': 'red',
                            'Not Requested': 'gray',
                          }[req.status] || 'gray';
                          const hipaaColor: any = { Signed: 'green', Sent: 'blue', Expired: 'red', 'Not Sent': 'gray' }[req.hipaaAuthStatus || 'Not Sent'] || 'gray';
                          return (
                            <div key={req.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-2">
                              <div className="flex flex-wrap items-center gap-2 justify-between">
                                <div>
                                  <span className="font-medium text-sm">{req.providerName}</span>
                                  {req.facilityName && <span className="text-xs text-gray-500 ml-2">@ {req.facilityName}</span>}
                                  {req.pregnancyNumber && <span className="ml-2 text-xs bg-gray-100 dark:bg-white/10 rounded px-1">Preg #{req.pregnancyNumber}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge color={statusColor}>{req.status}</Badge>
                                  {req.blockingIssues && <Badge color="red">Blocking</Badge>}
                                  <button onClick={async () => {
                                    if (!window.confirm('Delete this record request?')) return;
                                    const updated = await screeningService.deleteRecordRequest(id, req.id);
                                    setRecordRequests(updated);
                                  }} className="text-red-400 hover:text-red-600 text-xs"><i className="ri-delete-bin-line"></i></button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span>Type: {req.recordType}</span>
                                <span>Requested: {req.dateRequested ? new Date(req.dateRequested).toLocaleDateString() : '—'}</span>
                                <span>Method: {req.requestMethod || '—'}</span>
                                <span>Follow-up: {req.followUpDate ? new Date(req.followUpDate).toLocaleDateString() : '—'}</span>
                                <span>Auth on file: {req.authorizationOnFile ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-red-500">No</span>}</span>
                              </div>
                              {/* Inline status + HIPAA + review summary controls */}
                              <div className="flex flex-wrap gap-2 items-center">
                                <select value={req.status} onChange={async e => {
                                  const updated = await screeningService.updateRecordRequest(id, req.id, { status: e.target.value as MedicalRecordRequestStatus });
                                  setRecordRequests(updated);
                                }} className="text-xs rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1">
                                  {['Not Requested','Requested','Follow-Up Needed','Received (Partial)','Received (Complete)','Unable to Obtain'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <span className="text-xs text-gray-400">HIPAA:</span>
                                <select value={req.hipaaAuthStatus || 'Not Sent'} onChange={async e => {
                                  const updated = await screeningService.updateHipaaAuth(id, req.id, e.target.value as HipaaAuthStatus);
                                  setRecordRequests(updated);
                                }} className="text-xs rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1">
                                  {['Not Sent','Sent','Signed','Expired'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <Badge color={hipaaColor}>{req.hipaaAuthStatus || 'Not Sent'}</Badge>
                                {req.hipaaAuthSignedAt && <span className="text-xs text-gray-400">Signed {new Date(req.hipaaAuthSignedAt).toLocaleDateString()}</span>}
                              </div>
                              {/* Review summary */}
                              <div className="flex gap-2 items-start">
                                <input
                                  type="text"
                                  placeholder="Review summary (required before clearance)..."
                                  defaultValue={req.reviewSummary || ''}
                                  onBlur={async e => {
                                    if (e.target.value !== (req.reviewSummary || '')) {
                                      const updated = await screeningService.updateRecordRequest(id, req.id, {
                                        reviewSummary: e.target.value,
                                        clearanceRecommendation: req.clearanceRecommendation,
                                      });
                                      setRecordRequests(updated);
                                    }
                                  }}
                                  className="flex-1 text-xs rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1"
                                />
                                <select defaultValue={req.clearanceRecommendation || ''} onBlur={async e => {
                                  const updated = await screeningService.updateRecordRequest(id, req.id, { clearanceRecommendation: e.target.value as any });
                                  setRecordRequests(updated);
                                }} className="text-xs rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1">
                                  <option value="">— recommendation —</option>
                                  <option>Cleared</option>
                                  <option>Not Cleared</option>
                                  <option>Conditional / Needs Follow-Up</option>
                                </select>
                                <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                                  <input type="checkbox" defaultChecked={req.blockingIssues || false} onChange={async e => {
                                    const updated = await screeningService.updateRecordRequest(id, req.id, { blockingIssues: e.target.checked });
                                    setRecordRequests(updated);
                                  }} className="rounded" />
                                  Blocking
                                </label>
                              </div>
                              {/* Received files linked to this request */}
                              <div className="mt-1">
                                <p className="text-xs font-medium text-gray-500 mb-1">Received Files ({(req.receivedFiles || []).length})</p>
                                {(req.receivedFiles || []).map(f => (
                                  <div key={f.id} className="flex items-center gap-2 text-xs mb-1">
                                    <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate max-w-xs">{f.name}</a>
                                    <span className="text-gray-400">{f.fileType}</span>
                                    {f.pageCount && <span className="text-gray-400">{f.pageCount}pp</span>}
                                    <span className="text-gray-400">{new Date(f.receivedDate).toLocaleDateString()}</span>
                                    <button onClick={async () => {
                                      const updated = await screeningService.removeFileFromRequest(id, req.id, f.id);
                                      setRecordRequests(updated);
                                    }} className="text-red-400 hover:text-red-600"><i className="ri-close-line"></i></button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => {
                                    const url = window.prompt('File URL:');
                                    if (!url?.trim()) return;
                                    const name = window.prompt('File name:') || url.split('/').pop() || 'file';
                                    screeningService.addFileToRequest(id, req.id, {
                                      name,
                                      url,
                                      fileType: 'document',
                                      uploadedBy: 'admin',
                                      receivedDate: new Date().toISOString().split('T')[0],
                                    }).then(updated => setRecordRequests(updated));
                                  }}
                                  className="text-xs text-blue-500 hover:underline"
                                >
                                  <i className="ri-attachment-line mr-1"></i>Attach file
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
            </div>
        )}

        {activeTab === 'clinical' && (
            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Medications</h3><Button size="sm" onClick={() => navigate('/medical')}>Manage</Button></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-[#15111f]">
                                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Dosage</th><th className="px-4 py-3">Status</th></tr>
                            </thead>
                            <tbody>
                                {medications.map(m => (
                                    <tr key={m.id} className="border-t border-gray-100 dark:border-white/5"><td className="px-4 py-3 font-medium">{m.name}</td><td className="px-4 py-3">{m.dosage}</td><td className="px-4 py-3"><Badge color={m.status === 'Active' ? 'green' : 'gray'}>{m.status}</Badge></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )}

        {activeTab === 'finances' && (
            <div className="space-y-6">
                <Card>
                    <ReimbursementTracker userId={id} />
                </Card>
                <Card>
                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Legacy Payment History</h3><Button size="sm" onClick={() => navigate('/payments')}>Manage</Button></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-[#15111f]">
                                <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr>
                            </thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id} className="border-t border-gray-100 dark:border-white/5"><td className="px-4 py-3 font-medium">{p.type}</td><td className="px-4 py-3 font-mono">${Number(p.amount).toLocaleString()}</td><td className="px-4 py-3"><Badge color={getPaymentStatusColor(p.status)}>{p.status}</Badge></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )}

        {activeTab === 'documents' && (
            <Card>
                <FileUploadSection title="Documents" userId={surrogate.id} files={surrogate.documents ?? []} onFilesChange={(f: any) => handleUpdateField('documents', f)} />
            </Card>
        )}
      </div>
    </div>
  );
}
