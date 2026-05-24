import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import Card from '../../base/Card';
import Button from '../../base/Button';
import EditableJsonSection from '../../data/EditableJsonSection';
import CoreProfileCard from '../../data/CoreProfileCard';
import AboutSection from '../AboutSection';
import FileUploadSection from '../../data/FileUploadSection';
import Toast from '../../base/Toast';
import Badge from '../../base/Badge';
import MedicalReportView from '../MedicalReportView';
import { storageService } from '../../../services/storageService';
import { IP_STATUSES } from '../../../types';
import {
  resolveParentAdditionalProfile,
  resolveParent1Profile,
  resolveParent2Profile
} from '../../../utils/surrogateFormData';
import {
  IP_PARENT_FORM_TEMPLATE,
  IP_MEDICAL_REPORTS_TEMPLATE,
  IP_SURROGATE_RELATED_TEMPLATE,
  IP_FERTILITY_QUESTIONS_TEMPLATE,
  IP_INFECTIOUS_DISEASE_TEMPLATE,
  IP_EMBRYO_RECORDS_TEMPLATE,
  ABOUT_PARENT_TEMPLATE
} from '../../../constants/jsonTemplates';
import { STORAGE_BUCKETS } from '../../../services/storageService';
import { JourneyRoadmap } from '../JourneyRoadmap';
import ReimbursementTracker from '../ReimbursementTracker';

interface ParentProfileContentProps {
  id: string;
  onClose?: () => void;
  showBackButton?: boolean;
}

const PARENT_CORE_FIELDS = ['firstName', 'lastName', 'role', 'profileCompleted', 'form2Completed', 'profileCompletedAt', 'form2CompletedAt'] as const;

function isPopulated(obj: any) {
    if (!obj || typeof obj !== 'object') return false;
    return Object.keys(obj).length > 0;
}

function getPopulated(...args: any[]) {
    for (const arg of args) {
        if (isPopulated(arg)) return arg;
    }
    return null;
}

/** 
 * Clean Parent Data: Removes Surrogate-specific fields from Parent profile displays 
 */
function cleanParentData(data: any) {
    if (!data || typeof data !== 'object') return data;
    const clean = { ...data };
    
    // List of fields that are only for surrogates
    const surrogateOnlyFields = [
        'hasBirthedChildren', 'childrenBirthed', 'children_birthed',
        'medications', 'onPublicAssistance', 'on_public_assistance',
        'smokesVapes', 'smokes_vapes', 'smokes', 'vapes',
        'pregnancyHistory', 'menstrualFlow', 'cycleFlow',
        'surrogacyChildren', 'surrogacy_children'
    ];
    
    surrogateOnlyFields.forEach(field => {
        delete clean[field];
    });
    
    return clean;
}

/** Merge DB snake_case, legacy camelCase, and form_data (Flutter) into unified parent state. */
function parentStateFromRow(data: Record<string, any>) {
  const resolveJson = (v: any) => {
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch (e) { return v; }
    }
    return v;
  };

  const colFd = resolveJson(data.form_data ?? data.formData ?? {});
  const getNested = (obj: any) => (obj && typeof obj === 'object' && obj.form_data && typeof obj.form_data === 'object' && !Array.isArray(obj.form_data)) ? obj.form_data : null;
  const fd = { ...colFd, ...(getNested(colFd) || {}) };

  const firstName = data.first_name ?? data.firstName ?? fd.firstName ?? fd.first_name;
  const lastName = data.last_name ?? data.lastName ?? fd.lastName ?? fd.last_name;

  const p1 = resolveParent1Profile(fd, data);
  const p2 = resolveParent2Profile(fd, data);

  const calculateAge = (dob: any) => {
    if (!dob) return '';
    try {
      const birthDate = new Date(dob);
      if (isNaN(birthDate.getTime())) return '';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age.toString();
    } catch (e) {
      return '';
    }
  };

  const processParentData = (p: any) => {
    if (!p) return null;
    const cleaned = cleanParentData(p);
    if (cleaned && cleaned.dob && !cleaned.age) {
        cleaned.age = calculateAge(cleaned.dob);
    }
    return cleaned;
  };

  const cleanP1 = processParentData(p1);
  const cleanP2 = processParentData(p2);

  const ipAdd = resolveJson(fd.ip_additional ?? {});

  return {
    ...data,
    firstName: firstName ?? data.firstName ?? (cleanP1 as any)?.name?.split(' ')[0],
    lastName: lastName ?? data.lastName ?? (cleanP1 as any)?.name?.split(' ').slice(1).join(' '),
    profileImageUrl: data.profile_image_url ?? data.profileImageUrl,
    formData: fd,
    parent1: cleanP1,
    parent2: cleanP2,
    fertility: processParentData(getPopulated(fd.fertility_questions, fd.fertility, ipAdd?.fertility, ipAdd)),
    surrogateRelated: cleanParentData(getPopulated(fd.surrogate_related, ipAdd?.surrogate_related, ipAdd)),
    form2Data: resolveParentAdditionalProfile(fd, data),
    profileCompletedAt: data.profile_completed_at ?? data.profileCompletedAt,
    form2CompletedAt: data.form_2_completed_at ?? data.form2CompletedAt,
    profileCompleted: data.profile_completed ?? data.profileCompleted ?? false,
    form2Completed: data.form_2_completed ?? data.form2Completed ?? false,
  };
}

const TABS = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'application', label: 'Signup & App', icon: 'ri-file-user-line' },
    { id: 'personal', label: 'Detailed Application (Form 2)', icon: 'ri-profile-line' },
    { id: 'medical', label: 'Medical & Fertility', icon: 'ri-heart-pulse-line' },
    { id: 'finances', label: 'Finances & Expenses', icon: 'ri-bank-card-line' },
    { id: 'documents', label: 'Documents', icon: 'ri-folder-open-line' }
] as const;

export default function ParentProfileContent({ 
  id, 
  onClose, 
  showBackButton = true 
}: ParentProfileContentProps) {
  const navigate = useNavigate();
  const [parent, setParent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      if (data) {
        setParent(parentStateFromRow(data));
      } else {
        setParent(null);
      }
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

    const channel = supabase
      .channel(`parent-profile-${id}`)
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
          setParent(parentStateFromRow(d));
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
    return String(value);
  };

  const displayName = useMemo(() => {
    if (!parent) return 'Intended Parent Inquiry';
    const parentName = (parent.parent1 as any)?.name;
    if (parentName && parentName.trim().length > 0) return parentName;
    const formFirstName = (parent.formData as any)?.firstName;
    const formLastName = (parent.formData as any)?.lastName;
    const combined = [formFirstName, formLastName].filter(Boolean).join(' ');
    if (combined.length > 0) return combined;
    const fallbackCombined = [parent.firstName, parent.lastName].filter(Boolean).join(' ');
    if (fallbackCombined.length > 0) return fallbackCombined;
    return parent.email ?? 'Intended Parent Inquiry';
  }, [parent]);

  const initials = useMemo(() => {
    if (!displayName) return 'FM';
    return displayName.split(' ').filter(Boolean).map((p: string) => p[0]?.toUpperCase()).join('').slice(0, 2) || 'FM';
  }, [displayName]);

  const location = useMemo(() => {
    if (!parent) return null;
    const fd = parent.formData as any;
    const city = fd?.city?.trim();
    const state = fd?.state?.trim();
    const combined = [city, state].filter(Boolean).join(', ');
    return combined.length > 0 ? combined : null;
  }, [parent]);

  const phone = useMemo(() => {
    if (!parent) return null;
    const fd = parent.formData as Record<string, unknown> | undefined;
    const p1 = parent.parent1 as Record<string, unknown> | undefined;
    const p2 = parent.parent2 as Record<string, unknown> | undefined;
    const raw =
      fd?.phone ??
      fd?.phoneNumber ??
      fd?.phone_number ??
      p1?.phone ??
      p1?.phoneNumber ??
      p2?.phone ??
      p2?.phoneNumber ??
      parent.phone ??
      parent.phone_number ??
      parent.phoneNumber;
    const s = typeof raw === 'string' ? raw.trim() : '';
    return s.length > 0 ? s : null;
  }, [parent]);

  const timeline = useMemo(() => {
    if (!parent) return null;
    return (parent.formData as any)?.whenToStart ?? null;
  }, [parent]);

  const updatedAtText = useMemo(() => formatDateTime(parent?.updatedAt), [parent]);
  const createdAtText = useMemo(() => formatDateTime(parent?.createdAt), [parent]);

  const heroMeta = useMemo(() => [
    parent?.email && { 
      icon: 'ri-mail-line', 
      label: 'Email', 
      value: parent.email,
      href: `mailto:${parent.email}`
    },
    phone && { 
      icon: 'ri-phone-line', 
      label: 'Phone', 
      value: phone,
      href: `tel:${phone}`
    },
    location && { icon: 'ri-map-pin-line', label: 'Location', value: location },
    timeline && { icon: 'ri-timer-line', label: 'Intended Timeline', value: timeline }
  ].filter(Boolean) as any[], [location, parent?.email, phone, timeline]);

  // Per client review: IP is match-eligible when status is "Match Pending"
  const isEligibleForMatch = useMemo(() => parent?.status === 'Match Pending', [parent?.status]);

  const summaryCards = useMemo(() => [
    {
      label: 'Profile Status',
      value: parent?.profileCompleted ? 'Ready' : 'In Progress',
      icon: parent?.profileCompleted ? 'ri-heart-3-line' : 'ri-time-line',
      className: parent?.profileCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    },
    {
      label: 'Match Eligibility',
      value: isEligibleForMatch ? 'Eligible' : 'Not Eligible',
      icon: isEligibleForMatch ? 'ri-links-line' : 'ri-lock-line',
      className: isEligibleForMatch ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
    },
    { label: 'Timeline', value: timeline ?? '—', icon: 'ri-calendar-line', className: 'bg-white dark:bg-[#0e0b1a] border border-rose-100/60 dark:border-white/5 text-gray-700 dark:text-gray-200' },
    { label: 'Last Updated', value: updatedAtText, icon: 'ri-refresh-line', className: 'bg-white dark:bg-[#0e0b1a] border border-rose-100/60 dark:border-white/5 text-gray-700 dark:text-gray-200' }
  ], [isEligibleForMatch, parent?.profileCompleted, timeline, updatedAtText]);

  const handleUpdateField = async (field: string, value: any) => {
    if (!id) return;

    const mergedFormData = () => ({ ...(parent.formData || parent.form_data || {}) });

    let updatePayload: Record<string, unknown> = {};

    if (field.startsWith('form_data.')) {
      const sub = field.slice('form_data.'.length);
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
      setToast({ message: 'Inquiry updated successfully', type: 'success' });
      fetchParent();
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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#0e0b1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading intended parent inquiry...</p>
        </div>
      </div>
    );
  }

  if (error || !parent) {
    return (
      <div className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto p-12 text-center border-dashed border-2">
           <i className="ri-error-warning-line text-4xl text-rose-500 mb-4"></i>
           <h3 className="text-xl font-bold text-gray-900 dark:text-white">Inquiry Not Found</h3>
           <p className="text-gray-500 mt-2">{error || "The intended parent inquiry you are looking for doesn't exist or has been removed."}</p>
           <Button className="mt-6" onClick={() => navigate('/parents')}>Back to Parents</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0e0b1a] relative no-scrollbar">
      <div className="relative h-64 bg-gradient-to-br from-rose-500 to-indigo-600 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
           <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2)_0%,transparent_50%)]"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row items-end gap-6 bg-gradient-to-t from-black/60 to-transparent">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white border-4 border-white/20 shadow-2xl overflow-hidden flex items-center justify-center text-rose-500 font-bold text-4xl">
              {parent.profileImageUrl ? (
                <img src={parent.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : initials}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 w-10 h-10 rounded-2xl bg-white text-gray-900 shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
               {isUploadingImage ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-camera-line"></i>}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          </div>
          <div className="flex-1 text-white">
             <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black tracking-tight">{displayName}</h1>
                <select value={parent.status || 'Inquiry'} onChange={(e) => handleStatusChange(e.target.value)} className="bg-transparent border-none text-white focus:ring-0 cursor-pointer py-0 pl-0 pr-8 font-semibold [&>option]:text-gray-900">
                  {IP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur"><i className="ri-hashtag text-base"></i> ID: {parent.id}</div>
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

      <div className="max-w-7xl mx-auto p-6">
      <div className="space-y-6">
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 lg:col-span-2">
                        {summaryCards.map((card) => (
                            <Card key={card.label} padding="sm" className={`${card.className} border-none shadow-sm backdrop-blur`}>
                                <div className="flex items-start justify-between">
                                    <div><p className="text-xs font-semibold uppercase opacity-70">{card.label}</p><p className="mt-2 text-lg font-semibold">{card.value}</p></div>
                                    <span className="text-xl opacity-70"><i className={card.icon}></i></span>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CoreProfileCard title="Inquiry Core Details" data={parent} fields={PARENT_CORE_FIELDS} onSave={(field, val) => handleUpdateField(field, val)} />
                    </Card>

                    <Card>
                       <AboutSection 
                          title="Inquiry Bio" 
                          description="Personal background and surrogacy motivation."
                          data={parent.formData?.about_parent || parent.parent1?.about_yourself || null} 
                          templateData={ABOUT_PARENT_TEMPLATE}
                          onSave={(val) => handleUpdateField(parent.formData?.about_parent ? 'form_data.about_parent' : 'form_data.parent1.about_yourself', val)}
                       />
                    </Card>

                    <Card className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold">Contact Channel</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-white/5 border border-rose-100/50 dark:border-white/5">
                                <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Primary Email</p>
                                <p className="text-gray-900 dark:text-white font-medium break-all">{parent.email}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-white/5 border border-rose-100/50 dark:border-white/5">
                                <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Mobile Phone</p>
                                <p className="text-gray-900 dark:text-white font-medium">{phone || '—'}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-white/5 border border-rose-100/50 dark:border-white/5">
                                <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Inquiry Date</p>
                                <p className="text-gray-900 dark:text-white font-medium">{createdAtText}</p>
                            </div>
                        </div>
                    </Card>

                    <div className="lg:col-span-1 space-y-6">
                        <Card>
                            <JourneyRoadmap role="Intended Parent" currentStatus={parent.status} />
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none shadow-lg">
                            <div className="flex flex-col h-full justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold">Intended Parent Guide</h3>
                                    <p className="text-sm text-white/80 mt-2">Educational materials and resources provided to these parents in the app dashboard.</p>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { title: 'Choosing Your Carrier', icon: 'ri-user-search-line' },
                                        { title: 'The Legal Roadmap', icon: 'ri-scales-3-line' },
                                        { title: 'Financial Planning', icon: 'ri-bank-card-line' }
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

            {activeTab === 'application' && (
                <div className="grid grid-cols-1 gap-6">
                    <Card><EditableJsonSection title="Registration Form (Signup)" data={parent.formData || null} onSave={(v: any) => handleUpdateField('form_data', v)} /></Card>
                </div>
            )}

            {activeTab === 'personal' && (
                <div className="grid grid-cols-1 gap-6">
                    <Card><EditableJsonSection title="Parent 2 (from App)" description="Personal information submitted by Parent 2 through the mobile app" data={parent.parent2 || null} templateData={IP_PARENT_FORM_TEMPLATE} onSave={(v: any) => handleUpdateField('form_data.parent2', v)} /></Card>
                    <Card><EditableJsonSection title="Surrogate Preferences" description="Surrogate relationship preferences submitted through the mobile app" data={parent.surrogateRelated || null} templateData={IP_SURROGATE_RELATED_TEMPLATE} onSave={(v: any) => handleUpdateField('form_data.surrogate_related', v)} /></Card>
                </div>
            )}

            {activeTab === 'medical' && (
                 <div className="grid grid-cols-1 gap-6">
                    <Card>
                        <MedicalReportView userType="parent" data={parent} name={displayName} userId={parent.id} />
                    </Card>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <Card>
                            <EditableJsonSection 
                                title="Medical Reports (from App)" 
                                description="Screening results and summary information from the Medical Reports form"
                                data={parent.formData?.ip_additional || null} 
                                templateData={IP_MEDICAL_REPORTS_TEMPLATE}
                                onSave={(v: any) => handleUpdateField('form_data.ip_additional', v)} 
                            />
                        </Card>
                        <Card>
                            <EditableJsonSection 
                                title="Fertility Questions" 
                                description="Information about fertility clinic, embryos, and family planning"
                                data={parent.formData?.fertility || null} 
                                templateData={IP_FERTILITY_QUESTIONS_TEMPLATE}
                                onSave={(v: any) => handleUpdateField('form_data.fertility', v)} 
                            />
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'finances' && (
                <Card>
                    <ReimbursementTracker userId={id} />
                </Card>
            )}

            {activeTab === 'documents' && (
                <Card>
                    <FileUploadSection 
                        title="Inquiry Document Vault" 
                        userId={id} 
                        bucket={STORAGE_BUCKETS.USERS} 
                        folder={`${id}/documents`} 
                    />
                </Card>
            )}
      </div>
      </div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
