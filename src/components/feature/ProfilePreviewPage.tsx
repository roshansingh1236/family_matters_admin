import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserPreview {
  id: string;
  role?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  profileImageUrl?: string;
  documents?: Array<{ url: string; name: string; type?: string }>;
  about?: Record<string, any>;
  formData?: Record<string, any>;
  form2Data?: Record<string, any>;
  parent1?: Record<string, any>;
  parent2?: Record<string, any>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getValue = (...args: any[]) =>
  args.find((v) => v !== undefined && v !== null && v !== '');

const calculateAge = (dob?: string): string => {
  if (!dob) return '';
  try {
    const date = new Date(dob);
    if (isNaN(date.getTime())) return '';
    return Math.abs(new Date(Date.now() - date.getTime()).getUTCFullYear() - 1970).toString();
  } catch {
    return '';
  }
};

const isImageDoc = (doc: any) =>
  doc.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status?: string }) => {
  const colors: Record<string, string> = {
    'To be Matched': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Matched': 'bg-blue-100 text-blue-700 border-blue-200',
    'Rematch': 'bg-amber-100 text-amber-700 border-amber-200',
    'On Hold': 'bg-gray-100 text-gray-600 border-gray-200',
    'Accepted to Program': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  };
  const cls = colors[status ?? ''] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {status ?? 'Unknown'}
    </span>
  );
};

// ─── Info Row ─────────────────────────────────────────────────────────────────

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
        <i className={`${icon} text-gray-500 dark:text-gray-400 text-sm`} />
      </div>
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 leading-snug">{value}</p>
      </div>
    </div>
  );
};

// ─── Section ──────────────────────────────────────────────────────────────────

const Section = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
    <div className="flex items-center gap-2 mb-1">
      <i className={`${icon} text-blue-500 text-base`} />
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{title}</h3>
    </div>
    {children}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setUser(data);
    } catch (err: any) {
      setError('Unable to load profile.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const isIP = user?.role === 'Intended Parent';
  const isGC = user?.role === 'Surrogate';

  const displayName = useMemo(() => {
    if (!user) return '';
    const fromParent1 = user.parent1?.name as string | undefined;
    if (fromParent1?.trim()) return fromParent1;
    const fn = (user.first_name ?? user.formData?.firstName ?? '') as string;
    const ln = (user.last_name ?? user.formData?.lastName ?? '') as string;
    const combined = [fn, ln].filter(Boolean).join(' ');
    if (combined.trim()) return combined;
    return user.email ?? 'Profile';
  }, [user]);

  const initials = useMemo(() =>
    displayName.split(' ').filter(Boolean).map((p: string) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?',
    [displayName]);

  const about = useMemo(() => {
    if (!user) return {};
    const a = user.about ?? {};
    const fd = user.formData ?? {};
    const f2 = user.form2Data ?? {};
    const p1 = user.parent1 ?? {};
    const p2 = user.parent2 ?? {};

    const p1Age = (p1 as any)?.age || calculateAge((p1 as any)?.dob) || calculateAge((f2?.parent1 as any)?.dob);
    const p2Age = (p2 as any)?.age || calculateAge((p2 as any)?.dob) || calculateAge((f2?.parent2 as any)?.dob);

    return {
      bio: getValue(a.bio, [(f2?.parent1 as any)?.aboutYourself, (f2?.parent2 as any)?.aboutYourself].filter(Boolean).join('\n\n'), (p1 as any)?.aboutYourself),
      aboutUs: getValue(a.aboutUs, fd.message, fd.whySurrogate, (f2?.surrogateRelated as any)?.additionalInfoForSurrogate, fd.messageToSurrogate),
      occupation: getValue(a.occupation, [(f2?.parent1 as any)?.occupation, (f2?.parent2 as any)?.occupation].filter(Boolean).join(' & '), [p1.occupation, p2.occupation].filter(Boolean).join(' & ')),
      education: getValue(a.education, [(f2?.parent1 as any)?.education, (f2?.parent2 as any)?.education].filter(Boolean).join(' & ')),
      hobbies: getValue(a.hobbies, [(f2?.parent1 as any)?.hobbiesInterests, (f2?.parent2 as any)?.hobbiesInterests].filter(Boolean).join(', ')),
      religion: getValue(a.religion, [(f2?.parent1 as any)?.religion, (f2?.parent2 as any)?.religion].filter(Boolean).join(' & ')),
      familyLifestyle: getValue(a.familyLifestyle, [(f2?.parent1 as any)?.personalityDescription, (f2?.parent2 as any)?.personalityDescription].filter(Boolean).join('\n\n')),
      relationshipPreference: getValue(a.relationshipPreference, (f2?.surrogateRelated as any)?.pregnancyRelationship, fd.relationshipType),
      age: getValue(a.age, [p1Age, p2Age].filter((x: string) => x && x !== '0').join(' & ')),
      location: [fd.city, fd.state].filter(Boolean).join(', ') || null,
      // GC specific
      surrogacyExperience: getValue((f2 as any)?.surrogacyExperience, (fd as any)?.surrogacyExperience, (f2 as any)?.previousSurrogacies),
      medicalHighlights: getValue((f2 as any)?.medicalHighlights, (f2 as any)?.healthSummary),
    };
  }, [user]);

  const images = useMemo(() => {
    const imgs: string[] = [];
    if (user?.profileImageUrl) imgs.push(user.profileImageUrl);
    user?.documents?.filter(isImageDoc).forEach((d) => imgs.push(d.url));
    return imgs;
  }, [user]);

  const fullProfilePath = isIP ? `/parents/${id}` : `/surrogates/${id}`;
  const backLabel = isIP ? 'Back' : 'Back';

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <i className="ri-loader-4-line text-3xl animate-spin text-blue-500" />
          </main>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">{error ?? 'Profile not found.'}</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">

          {/* ── Hero Banner ── */}
          <div className={`relative overflow-hidden px-8 pt-10 pb-32 ${isIP ? 'bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500' : 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600'}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.15),_transparent_60%)]" />
            <div className="relative max-w-4xl mx-auto">

              {/* Back button */}
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-8 transition-colors"
              >
                <i className="ri-arrow-left-line" />
                {backLabel}
              </button>

              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-2xl border-2 border-white/30 bg-white/10 backdrop-blur-xl overflow-hidden flex items-center justify-center text-3xl font-bold text-white shrink-0 shadow-xl">
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>

                {/* Name + meta */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-white leading-tight">{displayName}</h1>
                    <StatusBadge status={user.status} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-white/80">
                    <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                      <i className={isIP ? 'ri-parent-line' : 'ri-user-heart-line'} />
                      {isIP ? 'Intended Parent' : 'Gestational Carrier'}
                    </span>
                    {about.location && (
                      <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                        <i className="ri-map-pin-line" />
                        {about.location}
                      </span>
                    )}
                    {about.age && (
                      <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                        <i className="ri-cake-line" />
                        {about.age} yrs
                      </span>
                    )}
                  </div>
                </div>

                {/* Full profile button */}
                <button
                  onClick={() => navigate(fullProfilePath)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors shadow-lg shrink-0"
                >
                  <i className="ri-external-link-line" />
                  Full Profile
                </button>
              </div>
            </div>
          </div>

          {/* ── Content (overlaps hero) ── */}
          <div className="relative max-w-4xl mx-auto px-8 -mt-20 pb-12 space-y-5">

            {/* ── Photo Grid ── */}
            {images.length > 0 && (
              <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {images.slice(0, 3).map((url, i) => (
                  <div
                    key={url}
                    className={`overflow-hidden rounded-2xl bg-gray-200 dark:bg-gray-800 shadow-lg ${i === 0 && images.length >= 3 ? 'row-span-2' : ''}`}
                    style={{ aspectRatio: i === 0 && images.length >= 3 ? '1/1.4' : '1/1' }}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* ── About / Bio ── */}
            {(about.bio || about.aboutUs) && (
              <Section title={isIP ? 'About Us' : 'About Me'} icon="ri-user-smile-line">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                  {isIP ? (about.aboutUs || about.bio) : about.bio}
                </p>
              </Section>
            )}

            {/* ── Personal Info ── */}
            <Section title="Personal Info" icon="ri-profile-line">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon="ri-briefcase-line" label="Occupation" value={about.occupation} />
                <InfoRow icon="ri-graduation-cap-line" label="Education" value={about.education} />
                <InfoRow icon="ri-pray-line" label="Religion" value={about.religion} />
                <InfoRow icon="ri-mail-line" label="Email" value={user.email} />
              </div>
            </Section>

            {/* ── IP Only: Family Lifestyle + Relationship Preference ── */}
            {isIP && (
              <>
                {about.familyLifestyle && (
                  <Section title="Family & Lifestyle" icon="ri-home-heart-line">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                      {about.familyLifestyle}
                    </p>
                    {about.hobbies && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {about.hobbies.split(/[,&]/).map((h: string) => h.trim()).filter(Boolean).map((hobby: string) => (
                          <span key={hobby} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded-full border border-indigo-100 dark:border-indigo-800">
                            {hobby}
                          </span>
                        ))}
                      </div>
                    )}
                  </Section>
                )}
                {about.relationshipPreference && (
                  <Section title="Relationship with Surrogate" icon="ri-heart-line">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {about.relationshipPreference}
                    </p>
                  </Section>
                )}
              </>
            )}

            {/* ── GC Only: Experience + Medical ── */}
            {isGC && (
              <>
                {about.surrogacyExperience && (
                  <Section title="Surrogacy Experience" icon="ri-award-line">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                      {about.surrogacyExperience}
                    </p>
                  </Section>
                )}
                {about.hobbies && (
                  <Section title="Hobbies & Interests" icon="ri-seedling-line">
                    <div className="flex flex-wrap gap-2">
                      {about.hobbies.split(/[,&]/).map((h: string) => h.trim()).filter(Boolean).map((hobby: string) => (
                        <span key={hobby} className="px-3 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs rounded-full border border-rose-100 dark:border-rose-800">
                          {hobby}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}
                {about.medicalHighlights && (
                  <Section title="Medical Highlights" icon="ri-heart-pulse-line">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                      {about.medicalHighlights}
                    </p>
                  </Section>
                )}
              </>
            )}

            {/* ── Footer CTA ── */}
            <div className={`rounded-2xl p-6 flex items-center justify-between ${isIP ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800' : 'bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800'}`}>
              <div>
                <p className={`text-sm font-semibold ${isIP ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  Want to see the full profile?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  View all details, documents, and medical records.
                </p>
              </div>
              <button
                onClick={() => navigate(fullProfilePath)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${isIP ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
              >
                <i className="ri-external-link-line" />
                View Full Profile
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}