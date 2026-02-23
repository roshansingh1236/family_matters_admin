import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import Card from '../../base/Card';
import Button from '../../base/Button';
import EditableJsonSection from '../../data/EditableJsonSection';
import AboutSection from '../AboutSection';
import FileUploadSection from '../../data/FileUploadSection';
import { storageService, STORAGE_BUCKETS } from '../../../services/storageService';
import Toast from '../../base/Toast';
import {
  CORE_PROFILE_TEMPLATE,
  FORM_CONTACT_TEMPLATE,
  PARENT_FORM2_TEMPLATE,
  FERTILITY_TEMPLATE,
  PARENT_PROFILE_TEMPLATE,
  SURROGATE_PREFERENCES_TEMPLATE,
  IP_INFECTIOUS_DISEASE_TEMPLATE,
  IP_EMBRYO_RECORDS_TEMPLATE,
  ABOUT_PARENT_TEMPLATE
} from '../../../constants/jsonTemplates';
import CreateMatchDialog from '../CreateMatchDialog';

interface ParentProfileContentProps {
  id: string;
  onClose?: () => void;
  showBackButton?: boolean;
  showCreateMatch?: boolean;
}

const PARENT_CORE_FIELDS = ['firstName', 'lastName', 'role', 'profileCompleted', 'form2Completed', 'profileCompletedAt', 'form2CompletedAt'] as const;

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

export default function ParentProfileContent({ 
  id, 
  onClose, 
  showBackButton = true,
  showCreateMatch = true 
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
    return String(value);
  };

  const displayName = useMemo(() => {
    if (!parent) return 'Parent Profile';
    const parentName = (parent.parent1 as any)?.name;
    if (parentName && parentName.trim().length > 0) return parentName;
    const formFirstName = (parent.formData as any)?.firstName;
    const formLastName = (parent.formData as any)?.lastName;
    const combined = [formFirstName, formLastName].filter(Boolean).join(' ');
    if (combined.length > 0) return combined;
    const fallbackCombined = [parent.firstName, parent.lastName].filter(Boolean).join(' ');
    if (fallbackCombined.length > 0) return fallbackCombined;
    return parent.email ?? 'Parent Profile';
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

  const timeline = useMemo(() => {
    if (!parent) return null;
    return (parent.formData as any)?.whenToStart ?? null;
  }, [parent]);

  const updatedAtText = useMemo(() => formatDateTime(parent?.updatedAt), [parent]);
  const createdAtText = useMemo(() => formatDateTime(parent?.createdAt), [parent]);

  const heroMeta = useMemo(() => [
    parent?.email && { icon: 'ri-mail-line', label: 'Email', value: parent.email },
    location && { icon: 'ri-map-pin-line', label: 'Location', value: location },
    timeline && { icon: 'ri-timer-line', label: 'Intended Timeline', value: timeline }
  ].filter(Boolean) as any[], [location, parent?.email, timeline]);

  const summaryCards = useMemo(() => [
    {
      label: 'Profile Status',
      value: parent?.profileCompleted ? 'Complete' : 'In Progress',
      icon: parent?.profileCompleted ? 'ri-shield-check-line' : 'ri-time-line',
      className: parent?.profileCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    },
    {
      label: 'Form 2',
      value: parent?.form2Completed ? 'Submitted' : 'Pending',
      icon: parent?.form2Completed ? 'ri-file-check-line' : 'ri-draft-line',
      className: parent?.form2Completed ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    },
    { label: 'Created', value: createdAtText, icon: 'ri-calendar-line', className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200' },
    { label: 'Last Updated', value: updatedAtText, icon: 'ri-refresh-line', className: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200' }
  ], [createdAtText, parent?.form2Completed, parent?.profileCompleted, updatedAtText]);

  const handleUpdateField = async (field: string, value: any) => {
    if (!id) return;
    let updatePayload: any = {};
    if (field.includes('.')) {
      const [top, nest] = field.split('.');
      updatePayload = { [top]: { ...(parent[top] || {}), [nest]: value } };
    } else {
      updatePayload = { [field]: value };
    }
    const { error } = await supabase.from('users').update(updatePayload).eq('id', id);
    if (error) setToast({ message: `Failed to update ${field}`, type: 'error' });
    else {
      setParent((prev: any) => ({ ...prev, ...updatePayload }));
      setToast({ message: `${field} updated successfully`, type: 'success' });
    }
  };

  const handleUpdateCore = async (value: any) => {
    if (!id) return;
    const filtered = Object.keys(value).reduce((acc: any, key) => {
      if (PARENT_CORE_FIELDS.includes(key as any)) acc[key] = value[key];
      return acc;
    }, {});
    const { error } = await supabase.from('users').update(filtered).eq('id', id);
    if (error) setToast({ message: 'Failed to update core profile', type: 'error' });
    else {
      setParent((prev: any) => ({ ...prev, ...filtered }));
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
    if (!parent) return null;
    const about = parent.about ?? {};
    const fd = parent.formData ?? {};
    const f2d = parent.form2Data ?? {};
    const p1 = parent.parent1 ?? {};
    const p2 = parent.parent2 ?? {};
    const getValue = (...args: any[]) => args.find(v => v !== undefined && v !== null && v !== '');
    const calculateAge = (dob: string | undefined) => {
        if (!dob) return '';
        try {
            const date = new Date(dob);
            if (isNaN(date.getTime())) return '';
            return Math.abs(new Date(Date.now() - date.getTime()).getUTCFullYear() - 1970).toString();
        } catch { return ''; }
    };
    const p1Age = p1.age || calculateAge(p1.dob) || calculateAge((f2d.parent1 as any)?.dob);
    const p2Age = p2.age || calculateAge(p2.dob) || calculateAge((f2d.parent2 as any)?.dob);
    return {
        ...ABOUT_PARENT_TEMPLATE,
        ...about,
        bio: getValue(about.bio, parent.bio, [(f2d.parent1 as any)?.aboutYourself, (f2d.parent2 as any)?.aboutYourself].filter(Boolean).join('\n\n'), (p1 as any)?.aboutYourself) || '',
        aboutUs: getValue(about.aboutUs, fd.message, fd.whySurrogate, (f2d.surrogateRelated as any)?.additionalInfoForSurrogate, fd.messageToSurrogate, f2d.familyDescription) || '',
        relationshipPreference: getValue(about.relationshipPreference, parent.relationshipPreference, (f2d.surrogateRelated as any)?.pregnancyRelationship, fd.relationshipType) || '',
        occupation: getValue(about.occupation, parent.occupation, [(f2d.parent1 as any)?.occupation, (f2d.parent2 as any)?.occupation].filter(Boolean).join(' & '), [p1.occupation, p2.occupation].filter(Boolean).join(' & ')) || '',
        education: getValue(about.education, parent.education, [(f2d.parent1 as any)?.education, (f2d.parent2 as any)?.education].filter(Boolean).join(' & '), [p1.education, p2.education].filter(Boolean).join(' & ')) || '',
        hobbies: getValue(about.hobbies, [(f2d.parent1 as any)?.hobbiesInterests, (f2d.parent2 as any)?.hobbiesInterests].filter(Boolean).join(', ')) || '',
        religion: getValue(about.religion, [(f2d.parent1 as any)?.religion, (f2d.parent2 as any)?.religion].filter(Boolean).join(' & ')) || '',
        familyLifestyle: getValue(about.familyLifestyle, [(f2d.parent1 as any)?.personalityDescription, (f2d.parent2 as any)?.personalityDescription].filter(Boolean).join('\n\n')) || '',
        age: getValue(about.age, parent.age, fd.age, [p1Age, p2Age].filter(a => a && a !== '0').join(' & ')) || ''
    };
  }, [parent]);

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

  if (isLoading) return <div className="flex items-center justify-center p-12"><i className="ri-loader-4-line text-3xl animate-spin text-blue-500" /></div>;
  if (error || !parent) return <Card className="p-6 text-red-600">{error || 'Profile not found.'}</Card>;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex items-center justify-between">
        {showBackButton && (
          <Button variant="outline" onClick={() => navigate('/parents')}>
            <i className="ri-arrow-left-line mr-2"></i> Back to list
          </Button>
        )}
        <div className="flex items-center gap-2">
           {parent && showCreateMatch && <CreateMatchDialog user={parent} />}
           {onClose && (
             <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500">
               <i className="ri-close-line text-xl"></i>
             </button>
           )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_60%)] opacity-70" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-6">
            <div className="relative group">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-3xl font-semibold backdrop-blur-xl overflow-hidden">
                {parent.profileImageUrl ? <img src={parent.profileImageUrl} alt={displayName} className="h-full w-full object-cover"/> : initials}
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
                  <i className="ri-parent-line text-sm"></i> Intended Parent
                </span>
              </div>
              <p className="mt-3 text-sm text-white/80">Building their family journey through the Family Matters program.</p>
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
                <i className="ri-donut-chart-line text-base mr-1"></i> <span className="font-medium">Status:</span>
                <select value={parent.status || 'To be Matched'} onChange={(e) => handleStatusChange(e.target.value)} className="bg-transparent border-none text-white focus:ring-0 cursor-pointer py-0 pl-0 pr-8 font-semibold [&>option]:text-gray-900">
                  {PARENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur"><i className="ri-hashtag text-base"></i> ID: {parent.id}</div>
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
                <Card><EditableJsonSection title="Core Profile" data={Object.fromEntries(PARENT_CORE_FIELDS.map(f => [f, parent[f]]))} templateData={CORE_PROFILE_TEMPLATE} onSave={handleUpdateCore} /></Card>
            </>
        )}

        {activeTab === 'about' && (
             <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="xl:col-span-5 space-y-4">
                    <div className="columns-1 gap-4 sm:columns-2 space-y-4">
                        {parent.profileImageUrl && <div className="rounded-2xl overflow-hidden shadow-md"><img src={parent.profileImageUrl} alt="" className="w-full"/></div>}
                        {parent.documents?.filter((d: any) => d.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name)).map((doc: any) => (
                            <div key={doc.url} className="rounded-2xl overflow-hidden shadow-md"><img src={doc.url} alt="" className="w-full transition-transform hover:scale-105"/></div>
                        ))}
                    </div>
                </div>
                <div className="xl:col-span-7">                <Card><AboutSection title={`About ${displayName}`} data={aboutData} type="parent" templateData={ABOUT_PARENT_TEMPLATE} onSave={(v: any) => handleUpdateField('about', v)} /></Card></div>
            </div>
        )}

        {activeTab === 'personal' && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card><EditableJsonSection title="Parent 1" data={parent.parent1 || null} templateData={PARENT_PROFILE_TEMPLATE} onSave={(v: any) => handleUpdateField('parent1', v)} /></Card>
                <Card><EditableJsonSection title="Parent 2" data={parent.parent2 || null} templateData={PARENT_PROFILE_TEMPLATE} onSave={(v: any) => handleUpdateField('parent2', v)} /></Card>
            </div>
        )}

        {activeTab === 'medical' && (
             <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card className="xl:col-span-2"><EditableJsonSection title="Fertility Information" data={parent.form2Data?.fertility || null} templateData={FERTILITY_TEMPLATE} onSave={(v: any) => handleUpdateField('form2Data.fertility', v)} /></Card>
                <Card><EditableJsonSection title="Infectious Disease" data={parent.form2Data?.infectiousDisease || null} templateData={IP_INFECTIOUS_DISEASE_TEMPLATE} onSave={(v: any) => handleUpdateField('form2Data.infectiousDisease', v)} /></Card>
                <Card><EditableJsonSection title="Embryo Records" data={parent.form2Data?.embryoRecords || null} templateData={IP_EMBRYO_RECORDS_TEMPLATE} onSave={(v: any) => handleUpdateField('form2Data.embryoRecords', v)} /></Card>
            </div>
        )}

        {activeTab === 'intake' && (
             <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card><EditableJsonSection title="Form 1 Responses" data={parent.formData || null} templateData={FORM_CONTACT_TEMPLATE} onSave={(v: any) => handleUpdateField('formData', v)} /></Card>
                <Card><EditableJsonSection title="Form 2 Responses" data={parent.form2Data || null} templateData={PARENT_FORM2_TEMPLATE} onSave={(v: any) => handleUpdateField('form2Data', v)} /></Card>
                <Card className="xl:col-span-2"><EditableJsonSection title="Surrogate Preferences" data={parent.surrogateRelated || null} templateData={SURROGATE_PREFERENCES_TEMPLATE} onSave={(v: any) => handleUpdateField('surrogateRelated', v)} /></Card>
            </div>
        )}

        {activeTab === 'documents' && (
            <Card>
                <FileUploadSection title="Documents" userId={parent.id} files={parent.documents ?? []} onFilesChange={(f: any) => handleUpdateField('documents', f)} />
            </Card>
        )}
      </div>
    </div>
  );
}
