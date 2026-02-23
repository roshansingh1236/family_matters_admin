import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import Card from '../../base/Card';
import Button from '../../base/Button';
import EditableJsonSection from '../../data/EditableJsonSection';
import AboutSection from '../AboutSection';
import FileUploadSection from '../../data/FileUploadSection';
import Toast from '../../base/Toast';
import Badge from '../../base/Badge';
import { storageService, STORAGE_BUCKETS } from '../../../services/storageService';
import { medicalService, type Medication } from '../../../services/medicalService';
import { paymentService } from '../../../services/paymentService';
import type { Payment } from '../../../types';
import {
  CORE_PROFILE_TEMPLATE,
  FORM_CONTACT_TEMPLATE,
  SURROGATE_FORM2_TEMPLATE,
  SURROGATE_ADDITIONAL_TEMPLATE,
  SURROGATE_MEDICAL_FITNESS_TEMPLATE,
  SURROGATE_INFECTIOUS_DISEASE_TEMPLATE,
  SURROGATE_PSYCH_CLEARANCE_TEMPLATE,
  ABOUT_SURROGATE_TEMPLATE
} from '../../../constants/jsonTemplates';
import CreateMatchDialog from '../CreateMatchDialog';

interface SurrogateProfileContentProps {
  id: string;
  onClose?: () => void;
  showBackButton?: boolean;
  showCreateMatch?: boolean;
}

const SURROGATE_CORE_FIELDS = ['firstName', 'lastName', 'role', 'profileCompleted', 'form2Completed', 'profileCompletedAt', 'form2CompletedAt'] as const;

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
          setSurrogate(payload.new);
        }
      )
      .subscribe();

    const loadAdditionalData = async () => {
        try {
            const [meds, pays] = await Promise.all([
                medicalService.getMedicationsBySurrogateId(id),
                paymentService.getPaymentsBySurrogateId(id)
            ]);
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
    location && { icon: 'ri-map-pin-line', label: 'Location', value: location },
    availability && { icon: 'ri-calendar-check-line', label: 'Availability', value: availability }
  ].filter(Boolean) as any[], [availability, location, surrogate?.email]);

  const summaryCards = useMemo(() => [
    {
      label: 'Profile Status',
      value: surrogate?.profileCompleted ? 'Ready' : 'In Progress',
      icon: surrogate?.profileCompleted ? 'ri-heart-3-line' : 'ri-time-line',
      className: surrogate?.profileCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    },
    {
      label: 'Form 2',
      value: surrogate?.form2Completed ? 'Complete' : 'Pending',
      icon: surrogate?.form2Completed ? 'ri-clipboard-check-line' : 'ri-clipboard-line',
      className: surrogate?.form2Completed ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    },
    { label: 'Experience', value: experience ?? '—', icon: 'ri-user-heart-line', className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200' },
    { label: 'Last Updated', value: updatedAtText, icon: 'ri-refresh-line', className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200' }
  ], [experience, surrogate?.form2Completed, surrogate?.profileCompleted, updatedAtText]);

  const handleUpdateField = async (field: string, value: any) => {
    if (!id) return;
    let updatePayload: any = {};
    if (field.includes('.')) {
      const [top, nest] = field.split('.');
      updatePayload = { [top]: { ...(surrogate[top] || {}), [nest]: value } };
    } else {
      updatePayload = { [field]: value };
    }
    const { error } = await supabase.from('users').update(updatePayload).eq('id', id);
    if (error) setToast({ message: `Failed to update ${field}`, type: 'error' });
    else {
      setSurrogate((prev: any) => ({ ...prev, ...updatePayload }));
      setToast({ message: `${field} updated successfully`, type: 'success' });
    }
  };

  const handleUpdateCore = async (value: any) => {
    if (!id) return;
    const filtered = Object.keys(value).reduce((acc: any, key) => {
      if (SURROGATE_CORE_FIELDS.includes(key as any)) acc[key] = value[key];
      return acc;
    }, {});
    const { error } = await supabase.from('users').update(filtered).eq('id', id);
    if (error) setToast({ message: 'Failed to update core profile', type: 'error' });
    else {
      setSurrogate((prev: any) => ({ ...prev, ...filtered }));
      setToast({ message: 'Core profile updated successfully', type: 'success' });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', id);
    if (error) setToast({ message: 'Failed to update status', type: 'error' });
    else setToast({ message: 'Status updated successfully', type: 'success' });
  };

  const aboutData = useMemo(() => {
    if (!surrogate) return null;
    const about = surrogate.about ?? {};
    const fd = surrogate.formData ?? {};
    const nF2 = fd.form2 ?? {};
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
                <select value={surrogate.status || 'Available'} onChange={(e) => handleStatusChange(e.target.value)} className="bg-transparent border-none text-white focus:ring-0 cursor-pointer py-0 pl-0 pr-8 font-semibold [&>option]:text-gray-900">
                  {SURROGATE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur"><i className="ri-hashtag text-base"></i> ID: {surrogate.id}</div>
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur"><i className="ri-time-line text-base"></i> Joined: {createdAtText}</div>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 no-scrollbar">
          {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
                     <Card>
                        <EditableJsonSection title="Core Profile" data={Object.fromEntries(SURROGATE_CORE_FIELDS.map(f => [f, surrogate[f]])) as any} templateData={CORE_PROFILE_TEMPLATE} onSave={handleUpdateCore} />
                    </Card>
                    <Card>
                        <EditableJsonSection title="Additional Profile Data" data={surrogate.form2Data || null} templateData={SURROGATE_ADDITIONAL_TEMPLATE} onSave={(v) => handleUpdateField('form2Data', v)} />
                    </Card>
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

        {activeTab === 'personal' && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card><EditableJsonSection title="Form 1 Responses" data={surrogate.formData || null} templateData={FORM_CONTACT_TEMPLATE} onSave={(v: any) => handleUpdateField('formData', v)} /></Card>
                <Card><EditableJsonSection title="Form 2 Responses" data={surrogate.form2 || null} templateData={SURROGATE_FORM2_TEMPLATE} onSave={(v: any) => handleUpdateField('form2', v)} /></Card>
            </div>
        )}

        {activeTab === 'medical_intake' && (
             <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card className="xl:col-span-2"><EditableJsonSection title="Medical Fitness" data={surrogate.form2?.medicalFitness || null} templateData={SURROGATE_MEDICAL_FITNESS_TEMPLATE} onSave={(v: any) => handleUpdateField('form2.medicalFitness', v)} /></Card>
                <Card><EditableJsonSection title="Infectious Disease" data={surrogate.form2?.infectiousDisease || null} templateData={SURROGATE_INFECTIOUS_DISEASE_TEMPLATE} onSave={(v: any) => handleUpdateField('form2.infectiousDisease', v)} /></Card>
                <Card><EditableJsonSection title="Psychological Clearance" data={surrogate.form2?.psychClearance || null} templateData={SURROGATE_PSYCH_CLEARANCE_TEMPLATE} onSave={(v: any) => handleUpdateField('form2.psychClearance', v)} /></Card>
            </div>
        )}

        {activeTab === 'clinical' && (
            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Medications</h3><Button size="sm" onClick={() => navigate('/medical')}>Manage</Button></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Dosage</th><th className="px-4 py-3">Status</th></tr>
                            </thead>
                            <tbody>
                                {medications.map(m => (
                                    <tr key={m.id} className="border-t border-gray-100 dark:border-gray-700"><td className="px-4 py-3 font-medium">{m.name}</td><td className="px-4 py-3">{m.dosage}</td><td className="px-4 py-3"><Badge color={m.status === 'Active' ? 'green' : 'gray'}>{m.status}</Badge></td></tr>
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
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr>
                        </thead>
                        <tbody>
                            {payments.map(p => (
                                <tr key={p.id} className="border-t border-gray-100 dark:border-gray-700"><td className="px-4 py-3 font-medium">{p.type}</td><td className="px-4 py-3 font-mono">${Number(p.amount).toLocaleString()}</td><td className="px-4 py-3"><Badge color={getPaymentStatusColor(p.status)}>{p.status}</Badge></td></tr>
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
