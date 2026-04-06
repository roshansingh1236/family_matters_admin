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
  ABOUT_SURROGATE_TEMPLATE
} from '../../../constants/jsonTemplates';
import CreateMatchDialog from '../CreateMatchDialog';
import MedicalReportView from '../MedicalReportView';
import { GC_STATUSES, GC_MEDICAL_SCREENING_STATUSES } from '../../../types';
import {
  resolveSurrogateAdditionalProfile,
  resolveSurrogateIntakeProfile
} from '../../../utils/surrogateFormData';
import { medicalIntakeProfileSource } from '../../../utils/surrogateMedicalFromProfile';
import { normalizeUserDocuments } from '../../../utils/userDocuments';
import SurrogateMedicalIntakeView from '../../data/SurrogateMedicalIntakeView';

interface SurrogateProfileContentProps {
  id: string;
  onClose?: () => void;
  showBackButton?: boolean;
  showCreateMatch?: boolean;
}

const SURROGATE_CORE_FIELDS = ['firstName', 'lastName', 'role', 'profileCompleted', 'form2Completed', 'profileCompletedAt', 'form2CompletedAt'] as const;

/** Merge DB snake_case, legacy camelCase, and form_data (Flutter) into UI firstName/lastName. */
function surrogateStateFromRow(data: Record<string, any>) {
  const fd = { ...(data.form_data ?? data.formData ?? {}) };
  const intake = resolveSurrogateIntakeProfile(fd, data);
  const additional = resolveSurrogateAdditionalProfile(fd, data);
  const firstName = data.first_name ?? data.firstName ?? fd.firstName ?? fd.first_name;
  const lastName = data.last_name ?? data.lastName ?? fd.lastName ?? fd.last_name;
  const profileCompletedAt =
    data.profile_completed_at ??
    data.profileCompletedAt ??
    fd.profileCompletedAt ??
    fd.profile_completed_at ??
    '';
  const form2CompletedAt =
    data.form_2_completed_at ??
    data.form2_completed_at ??
    data.form2CompletedAt ??
    fd.form2CompletedAt ??
    fd.form_2_completed_at ??
    '';
  return {
    ...data,
    documents: normalizeUserDocuments(data.documents),
    firstName: firstName ?? data.firstName,
    lastName: lastName ?? data.lastName,
    profileCompletedAt,
    form2CompletedAt,
    formData: fd,
    form2: intake,
    form2Data: additional,
    form2Completed: data.form_2_completed ?? data.form2Completed ?? false,
    profileCompleted: data.profile_completed ?? data.profileCompleted ?? false,
    updatedAt: data.updated_at ?? data.updatedAt,
    createdAt: data.created_at ?? data.createdAt,
  };
}

const TABS = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'about', label: 'About', icon: 'ri-information-line' },
    { id: 'personal', label: 'Personal & Intake', icon: 'ri-user-line' },
    { id: 'medical_report', label: 'Medical Report', icon: 'ri-heart-pulse-line' },
    { id: 'medical_intake', label: 'Medical Intake', icon: 'ri-file-shield-line' },
    { id: 'clinical', label: 'Clinical Care', icon: 'ri-stethoscope-line' },
    { id: 'compensation', label: 'Compensation', icon: 'ri-money-dollar-circle-line' },
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
    surrogate?.email && { icon: 'ri-mail-line', label: 'Email', value: surrogate.email },
    phone && { icon: 'ri-phone-line', label: 'Phone', value: phone },
    location && { icon: 'ri-map-pin-line', label: 'Location', value: location },
    availability && { icon: 'ri-calendar-check-line', label: 'Availability', value: availability }
  ].filter(Boolean) as any[], [availability, location, phone, surrogate?.email]);

  const isEligibleForMatch = useMemo(() => {
    const screeningOk = (surrogate?.medical_screening_status ?? surrogate?.medicalScreeningStatus) === 'Medically Cleared for Program';
    const statusOk = surrogate?.status === 'Accepted to Program';
    return screeningOk && statusOk;
  }, [surrogate]);

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
      const nestKey = field.slice('form2.'.length);
      const fd = mergedFormData();
      const sp = {
        ...(typeof fd.surrogate_profile === 'object' && fd.surrogate_profile
          ? (fd.surrogate_profile as Record<string, unknown>)
          : {})
      };
      sp[nestKey] = value;
      fd.surrogate_profile = sp;
      updatePayload = { form_data: fd };
    } else if (field === 'form2Data') {
      updatePayload = { form2_data: value };
    } else if (field.includes('.')) {
      const [top, nest] = field.split('.');
      updatePayload = { [top]: { ...(surrogate[top] || {}), [nest]: value } };
    } else {
      updatePayload = { [field]: value };
    }

    const { error } = await supabase.from('users').update(updatePayload).eq('id', id);
    if (error) setToast({ message: `Failed to update ${field}`, type: 'error' });
    else {
      setSurrogate((prev: any) =>
        surrogateStateFromRow({
          ...prev,
          ...updatePayload,
          form_data:
            (updatePayload.form_data as Record<string, unknown>) ??
            prev.form_data ??
            prev.formData,
          form2_data: (updatePayload.form2_data as Record<string, unknown>) ?? prev.form2_data
        })
      );
      setToast({ message: `${field} updated successfully`, type: 'success' });
    }
  };

  const handleUpdateCore = async (value: any) => {
    if (!id || !surrogate) return;
    const filtered = Object.keys(value).reduce((acc: any, key) => {
      if (SURROGATE_CORE_FIELDS.includes(key as any)) acc[key] = value[key];
      return acc;
    }, {});
    const dbPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('firstName' in filtered) dbPayload.first_name = filtered.firstName;
    if ('lastName' in filtered) dbPayload.last_name = filtered.lastName;
    if ('role' in filtered) dbPayload.role = filtered.role;
    if ('profileCompleted' in filtered) dbPayload.profile_completed = filtered.profileCompleted;
    if ('form2Completed' in filtered) dbPayload.form_2_completed = filtered.form2Completed;
    if ('profileCompletedAt' in filtered) {
      const v = filtered.profileCompletedAt;
      dbPayload.profile_completed_at = v === '' || v === undefined || v === null ? null : v;
    }
    if ('form2CompletedAt' in filtered) {
      const v = filtered.form2CompletedAt;
      dbPayload.form_2_completed_at = v === '' || v === undefined || v === null ? null : v;
    }
    if ('profileCompleted' in filtered && filtered.profileCompleted === false) {
      dbPayload.profile_completed_at = null;
    }
    if ('form2Completed' in filtered && filtered.form2Completed === false) {
      dbPayload.form_2_completed_at = null;
    }

    if ('firstName' in filtered || 'lastName' in filtered) {
      const fd = { ...(surrogate.formData || {}) };
      if ('firstName' in filtered) fd.firstName = filtered.firstName;
      if ('lastName' in filtered) fd.lastName = filtered.lastName;
      dbPayload.form_data = fd;
    }

    const { error } = await supabase.from('users').update(dbPayload).eq('id', id);
    if (error) setToast({ message: 'Failed to update core profile', type: 'error' });
    else {
      setSurrogate((prev: any) =>
        surrogateStateFromRow({
          ...prev,
          ...dbPayload,
          form_data: (dbPayload.form_data as Record<string, unknown>) ?? prev.form_data ?? prev.formData,
          first_name: (dbPayload.first_name as string | undefined) ?? prev.first_name,
          last_name: (dbPayload.last_name as string | undefined) ?? prev.last_name,
          profile_completed: (dbPayload.profile_completed as boolean | undefined) ?? prev.profile_completed,
          form_2_completed: (dbPayload.form_2_completed as boolean | undefined) ?? prev.form_2_completed,
        })
      );
      setToast({ message: 'Core profile updated successfully', type: 'success' });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;

    // Per spec: GC cannot be "Accepted to Program" unless medically cleared
    if (newStatus === 'Accepted to Program') {
      const screeningStatus = surrogate?.medical_screening_status ?? surrogate?.medicalScreeningStatus;
      if (screeningStatus !== 'Medically Cleared for Program') {
        setToast({
          message: `Cannot set "Accepted to Program": Medical Screening must be "Medically Cleared for Program" first. Current: "${screeningStatus || 'Not Started'}".`,
          type: 'error',
        });
        return;
      }
    }

    // Per spec: "Declined / Inactive" requires a reason
    if (newStatus === 'Declined / Inactive') {
      const reason = window.prompt('Reason for declining (required):');
      if (!reason?.trim()) {
        setToast({ message: 'A decline reason is required.', type: 'error' });
        return;
      }
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, decline_reason: reason.trim(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) setToast({ message: 'Failed to update status', type: 'error' });
      else {
        setSurrogate((prev: any) => ({ ...prev, status: newStatus, decline_reason: reason.trim() }));
        setToast({ message: 'Status updated', type: 'success' });
      }
      return;
    }

    const prevStatus = surrogate?.status;
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) setToast({ message: 'Failed to update status', type: 'error' });
    else {
      setSurrogate((prev: any) => ({ ...prev, status: newStatus }));
      setToast({ message: 'Status updated successfully', type: 'success' });
      auditService.log(`GC status changed: ${prevStatus} → ${newStatus}`, 'user', id, {
        before: { status: prevStatus }, after: { status: newStatus },
      });
    }
  };

  const aboutData = useMemo(() => {
    if (!surrogate) return null;
    const about = surrogate.about ?? {};
    const fd = surrogate.formData ?? {};
    const nF2 = (surrogate.form2 as Record<string, unknown>) ?? fd.surrogate_profile ?? fd.form2 ?? {};
    const getValue = (...args: any[]) => args.find(v => v !== undefined && v !== null && v !== '');
    const age = getValue(about.age, surrogate.age, fd.age, nF2.age);
    let calcAge = '';
    if (!age && fd.dateOfBirth) {
      try {
        const dob = new Date(fd.dateOfBirth);
        calcAge = String(Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970));
      } catch {}
    }
    return {
      ...ABOUT_SURROGATE_TEMPLATE,
      ...about,
      age: age ? String(age) : calcAge,
      height: getValue(about.height, surrogate.height, fd.height, nF2.height) ?? '',
      education: getValue(about.education, surrogate.education, fd.educationLevel, nF2.educationLevel, fd['Education Level']) || '',
      occupation: getValue(about.occupation, surrogate.occupation, fd.occupation, nF2.occupation, fd['Occupation']) || '',
      bioMotherHeritage: getValue(about.bioMotherHeritage, surrogate.bioMotherHeritage, fd.ethnicity, nF2.ethnicity, fd['Ethnicity']) || '',
      bioFatherHeritage: about.bioFatherHeritage || '',
      relationshipPreference: getValue(about.relationshipPreference, surrogate.relationshipPreference, fd.relationshipStatus, nF2.relationshipStatus, fd['Relationship Status']) || '',
      bio: getValue(about.bio, surrogate.bio, fd.messageToParents, nF2.messageToParents, fd['Message To Parents'], fd.surrogacyReasons, nF2.surrogacyReasons) || ''
    };
  }, [surrogate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    try {
      setIsUploadingImage(true);
      const path = `${id}/profile/avatar_${Date.now()}_${file.name}`;
      const { url } = await storageService.uploadFile(STORAGE_BUCKETS.USERS, path, file);
      await supabase.from('users').update({ profileImageUrl: url }).eq('id', id);
      setToast({ message: 'Profile picture updated successfully', type: 'success' });
    } catch {
      setToast({ message: 'Failed to upload profile picture', type: 'error' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const getPaymentStatusColor = (status: string): any => {
    switch(status) {
        case 'Paid': return 'green';
        case 'Pending': return 'yellow';
        case 'Overdue': return 'red';
        default: return 'gray';
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><i className="ri-loader-4-line text-3xl animate-spin text-blue-500" /></div>;
  if (error || !surrogate) return <Card className="p-6 text-red-600">{error || 'Profile not found.'}</Card>;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex items-center justify-between">
        {showBackButton && (
          <Button variant="outline" onClick={() => navigate('/surrogates')}>
            <i className="ri-arrow-left-line mr-2"></i> Back to list
          </Button>
        )}
        <div className="flex items-center gap-2">
           {surrogate && showCreateMatch && <CreateMatchDialog user={surrogate} />}
           {onClose && (
             <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500">
               <i className="ri-close-line text-xl"></i>
             </button>
           )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-500 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.3),_transparent_65%)] opacity-80" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-6">
            <div className="relative group">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/40 bg-white/10 text-3xl font-semibold backdrop-blur-xl overflow-hidden">
                {surrogate.profileImageUrl ? <img src={surrogate.profileImageUrl} alt={displayName} className="h-full w-full object-cover"/> : initials}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingImage ? <i className="ri-loader-4-line animate-spin text-white text-xl"></i> : <i className="ri-camera-line text-white text-xl"></i>}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden"/>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold leading-tight">{displayName}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  <i className="ri-user-heart-line text-sm"></i> Surrogate
                </span>
              </div>
              <p className="mt-3 text-sm text-white/80">Compassionate partner ready to support intended parents throughout the journey.</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-white/90">
                {heroMeta.map((item: any) => (
                  <span key={item.label} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">
                    <i className={`${item.icon} text-base`}></i> <span>{item.value}</span>
                  </span>
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
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur"><i className="ri-hashtag text-base"></i> ID: {surrogate.id}</div>
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur"><i className="ri-time-line text-base"></i> Joined: {createdAtText}</div>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-rose-100/60 dark:border-white/5 no-scrollbar">
          {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-rose-500 text-rose-600 dark:text-rose-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <i className={tab.icon}></i> {tab.label}
              </button>
          ))}
      </div>

      <div className="space-y-6">
        {activeTab === 'overview' && (
            <>
                 <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                        <Card key={card.label} padding="sm" className={`${card.className} border-none shadow-sm backdrop-blur`}>
                            <div className="flex items-start justify-between">
                                <div><p className="text-xs font-semibold uppercase opacity-70">{card.label}</p><p className="mt-2 text-lg font-semibold">{card.value}</p></div>
                                <span className="text-xl opacity-70"><i className={card.icon}></i></span>
                            </div>
                        </Card>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <CoreProfileCard
                    data={Object.fromEntries(SURROGATE_CORE_FIELDS.map((f) => [f, surrogate[f]])) as Record<string, unknown>}
                    fieldOrder={SURROGATE_CORE_FIELDS}
                    onSave={handleUpdateCore}
                    title="Core profile"
                    subtitle="Identity, role, and completion state stored on the user record (synced with the surrogate app)."
                  />
                </div>
            </>
        )}

        {activeTab === 'about' && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="xl:col-span-5 space-y-4">
                    <div className="columns-1 gap-4 sm:columns-2 space-y-4">
                        {surrogate.profileImageUrl && <div className="rounded-2xl overflow-hidden shadow-md"><img src={surrogate.profileImageUrl} alt="" className="w-full"/></div>}
                        {surrogate.documents?.filter((d: any) => d.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name)).map((doc: any) => (
                            <div key={doc.url} className="rounded-2xl overflow-hidden shadow-md"><img src={doc.url} alt="" className="w-full transition-transform hover:scale-105"/></div>
                        ))}
                    </div>
                </div>
                <div className="xl:col-span-7"><Card><AboutSection title={`About ${surrogate.firstName || 'Surrogate'}`} data={aboutData} type="surrogate" templateData={ABOUT_SURROGATE_TEMPLATE} onSave={(v: any) => handleUpdateField('about', v)} /></Card></div>
            </div>
        )}

        {activeTab === 'medical_report' && (
            <MedicalReportView
                userType="surrogate"
                data={surrogate}
                name={displayName}
                userId={surrogate.id}
                screeningStatus={surrogate.medical_screening_status ?? surrogate.medicalScreeningStatus}
                onUpdateScreeningStatus={async (status) => {
                    // Per spec: enforce clearance eligibility before allowing "Medically Cleared for Program"
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
                    if (error) {
                      console.error('medical_screening_status update', error);
                      setToast({
                        message: error.message?.includes('check constraint')
                          ? `Database rejected this status. Run migration 20260409_users_medical_screening_status_check.sql. ${error.message}`
                          : `Failed to update screening status: ${error.message}`,
                        type: 'error'
                      });
                    } else {
                      setSurrogate((prev: any) => ({ ...prev, medical_screening_status: status }));
                      setToast({ message: 'Screening status updated', type: 'success' });
                    }
                }}
            />
        )}

        {activeTab === 'personal' && (
            <div className="grid grid-cols-1 gap-6">
                {/* OB History — structured table parsed from flat intake fields */}
                {(() => {
                  const d = surrogate.form2 as any;
                  if (!d) return null;
                  const pregnancies = [1, 2, 3].map(n => ({
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
                    surrogacy: n > 1 ? d[`pregnancy${n}Surrogacy`] : null,
                  })).filter(p => p.name || p.dob || p.obgyn || p.hospital);

                  if (pregnancies.length === 0) return null;

                  return (
                    <Card>
                      <div className="p-4">
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">OB History</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Parsed from intake form — provider and hospital names are internal only, never shown to Intended Parents</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-[#15111f] text-xs uppercase text-gray-500">
                              <tr>
                                <th className="px-3 py-2">#</th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">DOB</th>
                                <th className="px-3 py-2">Delivery</th>
                                <th className="px-3 py-2">GA</th>
                                <th className="px-3 py-2">Complications</th>
                                <th className="px-3 py-2">OB/GYN <span className="text-rose-400">(internal)</span></th>
                                <th className="px-3 py-2">Hospital <span className="text-rose-400">(internal)</span></th>
                                <th className="px-3 py-2">Surrogacy?</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pregnancies.map(p => (
                                <tr key={p.number} className="border-t border-gray-100 dark:border-white/5">
                                  <td className="px-3 py-2 font-semibold">{p.number}</td>
                                  <td className="px-3 py-2">{p.name || '—'}</td>
                                  <td className="px-3 py-2">{p.dob ? new Date(p.dob).toLocaleDateString() : '—'}</td>
                                  <td className="px-3 py-2">{p.deliveryType || '—'}</td>
                                  <td className="px-3 py-2">{p.gestationalAge || '—'}</td>
                                  <td className="px-3 py-2">{p.complications || 'None'}</td>
                                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400 font-medium">{p.obgyn || '—'}</td>
                                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400 font-medium">{p.hospital || '—'}</td>
                                  <td className="px-3 py-2">{p.surrogacy || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {d.additionalPregnancyInfo && (
                          <p className="mt-3 text-xs text-gray-500">Additional info: {d.additionalPregnancyInfo}</p>
                        )}
                      </div>
                    </Card>
                  );
                })()}

                <Card className="overflow-hidden border-rose-100/70 shadow-md shadow-rose-500/5 dark:border-white/5 dark:shadow-none">
                  <div className="relative overflow-hidden border-b border-rose-100/60 bg-gradient-to-r from-rose-500/[0.08] via-fuchsia-500/[0.06] to-indigo-500/[0.05] px-6 py-5 dark:border-white/5 dark:from-rose-500/15 dark:via-fuchsia-500/10 dark:to-indigo-500/10">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-400/20 blur-2xl dark:bg-rose-500/10" />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-lg shadow-rose-500/30">
                          <i className="ri-smartphone-line text-2xl" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Intake form responses
                          </h2>
                          <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
                            Structured answers from the surrogate mobile app. When present, OB history is also summarized in the table above.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#fdf4f6]/30 p-5 dark:bg-[#0e0b1a]/40 md:p-6">
                    <SurrogateIntakeFormView data={surrogate.form2 as Record<string, unknown> | null} />
                  </div>
                  <details className="group border-t border-rose-100/50 bg-white dark:border-white/5 dark:bg-[#15111f]/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50/80 dark:text-rose-400 dark:hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-2">
                        <i className="ri-code-s-slash-line text-lg" />
                        Edit raw JSON (admin)
                      </span>
                      <i className="ri-arrow-down-s-line text-lg transition group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-rose-100/40 px-5 pb-6 pt-2 dark:border-white/5">
                      <EditableJsonSection
                        title="Surrogate intake JSON"
                        description="Direct edit of form_data.surrogate_profile — use only if you know the schema."
                        data={surrogate.form2 || null}
                        templateData={SURROGATE_INTAKE_TEMPLATE}
                        onSave={(v: any) => handleUpdateField('form_data.surrogate_profile', v)}
                      />
                    </div>
                  </details>
                </Card>
                <Card>
                    <EditableJsonSection
                        title="Additional Profile Data"
                        description="Stored in form_data.gc_additional (or legacy form2_data column). The mobile app does not populate this yet unless you add a save path."
                        data={surrogate.form2Data || null}
                        templateData={SURROGATE_ADDITIONAL_TEMPLATE}
                        onSave={(v: any) => handleUpdateField('form_data.gc_additional', v)}
                    />
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
                                {obEntries.map((e, i) => <option key={i} value={i}>Pregnancy #{e.n} – {e.provider || e.facility}</option>)}
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
                          }}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setShowAddRequest(false)}>Cancel</Button>
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

        {activeTab === 'compensation' && (
            <Card>
                 <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Payment History</h3><Button size="sm" onClick={() => navigate('/payments')}>Manage</Button></div>
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
