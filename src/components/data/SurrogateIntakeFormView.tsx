import React, { useMemo } from 'react';
import { formatMMDDYYYY } from '../../utils/dateFormat';

type SectionDef = {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  keys: string[];
};

const SECTIONS: SectionDef[] = [
  {
    id: 'basic',
    title: 'Contact & basics',
    subtitle: 'Identity and health vitals from the app',
    icon: 'ri-user-smile-line',
    keys: [
      'name',
      'email',
      'phone',
      'address',
      'height',
      'weight',
      'age',
      'dob',
      'bloodType'
    ]
  },
  {
    id: 'covid',
    title: 'COVID-19',
    icon: 'ri-shield-check-line',
    keys: ['receivedVaccination', 'openToVaccination']
  },
  {
    id: 'background',
    title: 'Background',
    icon: 'ri-global-line',
    keys: ['ethnicity', 'religion', 'languages', 'relationshipStatus', 'yearsTogether']
  },
  {
    id: 'transport',
    title: 'Transportation & schedule',
    icon: 'ri-car-line',
    keys: ['hasTransportation', 'canTravelForIVF', 'hasFlexibleSchedule']
  },
  {
    id: 'family',
    title: 'Household & family',
    icon: 'ri-home-heart-line',
    keys: ['hasCustody', 'householdMembers']
  },
  {
    id: 'work',
    title: 'Education & employment',
    icon: 'ri-briefcase-line',
    keys: [
      'educationLevel',
      'hasCollegeDegree',
      'collegeDetails',
      'isEmployed',
      'occupation',
      'workHours',
      'jobDuties',
      'partnerEmployed',
      'partnerOccupation',
      'partnerWorkHours',
      'partnerJobDuties'
    ]
  },
  {
    id: 'reproductive',
    title: 'Reproductive & medical history',
    icon: 'ri-heart-pulse-line',
    keys: [
      'regularCycles',
      'cycleFlow',
      'menstrualFlow',
      'lastPapSmear',
      'papSmearResults',
      'onBirthControl',
      'birthControlType',
      'isBreastfeeding',
      'mentalHealth',
      'usedTHC',
      'postpartumDepression',
      'bedrest',
      'hepatitisBVaccination',
      'rhogamInjection',
      'fertilityTreatments',
      'hadMiscarriage',
      'miscarriageDetails',
      'childrenBirthed',
      'surrogacyChildren'
    ]
  },
  {
    id: 'readiness',
    title: 'Program readiness',
    subtitle: 'Often captured on later steps',
    icon: 'ri-calendar-check-line',
    keys: ['availability', 'bmi', 'smoker', 'medications', 'supportSystem']
  },
  {
    id: 'ob-flat',
    title: 'Pregnancy history (intake)',
    subtitle: 'Matches the surrogate questionnaire; see OB table above when parsed',
    icon: 'ri-parent-line',
    keys: [
      'numberOfPregnancies',
      'pregnancy1Name',
      'pregnancy1Gender',
      'pregnancy1DOB',
      'pregnancy1Weight',
      'pregnancy1Delivery',
      'pregnancy1GestationalAge',
      'pregnancy1Complications',
      'pregnancy1OBGYN',
      'pregnancy1Hospital',
      'pregnancy2Name',
      'pregnancy2Gender',
      'pregnancy2DOB',
      'pregnancy2Weight',
      'pregnancy2Delivery',
      'pregnancy2GestationalAge',
      'pregnancy2Complications',
      'pregnancy2OBGYN',
      'pregnancy2Hospital',
      'pregnancy2Surrogacy',
      'pregnancy3Name',
      'pregnancy3Gender',
      'pregnancy3DOB',
      'pregnancy3Weight',
      'pregnancy3Delivery',
      'pregnancy3GestationalAge',
      'pregnancy3Complications',
      'pregnancy3OBGYN',
      'pregnancy3Hospital',
      'pregnancy3Surrogacy',
      'additionalPregnancyInfo'
    ]
  },
  {
    id: 'about',
    title: 'About me',
    icon: 'ri-emotion-happy-line',
    keys: [
      'favoriteFood',
      'favoriteColor',
      'favoriteFlower',
      'favoriteMovie',
      'relaxation',
      'relationshipDescription',
      'childrenRelationship',
      'hobbies',
      'personality',
      'childhoodMemory',
      'surrogacyReasons',
      'surrogacyExcitement'
    ]
  },
  {
    id: 'journey',
    title: 'Journey preferences',
    subtitle: 'Support, boundaries, and communication',
    icon: 'ri-hand-heart-line',
    keys: [
      'mainSupport',
      'spouseSupport',
      'childrenSupport',
      'parentsSupport',
      'friendsSupport',
      'coworkersSupport',
      'understandsAppointments',
      'duringRelationship',
      'afterRelationship',
      'allowOBAppointments',
      'allowDeliveryRoom',
      'helpCoupleWithChildren',
      'helpSameSexCouple',
      'helpSingleParent',
      'fetusesWilling',
      'reduceTripletsToTwins',
      'reduceTwinsToSingleton',
      'terminateIfNecessary',
      'terminateDownSyndrome',
      'amniocentesis',
      'agreeToFetalTesting',
      'willingForSplitTwins',
      'messageToParents'
    ]
  }
];

const SKIP_OTHER_KEYS = new Set(['surrogate_profile', 'form2', 'gc_additional']);

const formatLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
};

const formatValue = (value: unknown): string => {
  if (isEmpty(value)) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      const formatted = formatMMDDYYYY(t);
      if (formatted) return formatted;
    }
    return t;
  }
  if (Array.isArray(value)) return value.map((x) => formatValue(x)).filter(Boolean).join(', ');
  return JSON.stringify(value);
};

const allSectionKeys = new Set(SECTIONS.flatMap((s) => s.keys));

type Props = {
  data: Record<string, unknown> | null | undefined;
};

export default function SurrogateIntakeFormView({ data }: Props) {
  const { sectionRows, otherEntries, hasAny } = useMemo(() => {
    if (!data || typeof data !== 'object') {
      return { sectionRows: [] as { section: SectionDef; entries: [string, string][] }[], otherEntries: [] as [string, string][], hasAny: false };
    }

    const used = new Set<string>();
    const sectionRows: { section: SectionDef; entries: [string, string][] }[] = [];

    for (const section of SECTIONS) {
      const entries: [string, string][] = [];
      for (const key of section.keys) {
        const raw = data[key];
        if (raw !== undefined && raw !== null && typeof raw === 'object' && !Array.isArray(raw)) continue;
        const text = formatValue(raw);
        if (!text) continue;
        entries.push([key, text]);
        used.add(key);
      }
      if (entries.length > 0) sectionRows.push({ section, entries });
    }

    const otherEntries: [string, string][] = [];
    for (const key of Object.keys(data)) {
      if (used.has(key) || allSectionKeys.has(key)) continue;
      if (SKIP_OTHER_KEYS.has(key)) continue;
      const raw = data[key];
      if (raw !== undefined && raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        otherEntries.push([key, JSON.stringify(raw, null, 2)]);
        continue;
      }
      const text = formatValue(raw);
      if (text) otherEntries.push([key, text]);
    }

    otherEntries.sort(([a], [b]) => a.localeCompare(b));

    const hasAny = sectionRows.length > 0 || otherEntries.length > 0;
    return { sectionRows, otherEntries, hasAny };
  }, [data]);

  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-200/80 bg-gradient-to-br from-rose-50/80 via-white to-fuchsia-50/40 px-8 py-14 text-center dark:border-white/10 dark:from-rose-950/20 dark:via-[#0e0b1a] dark:to-fuchsia-950/10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md shadow-rose-200/40 dark:bg-white/5 dark:shadow-none">
          <i className="ri-file-list-3-line text-3xl text-rose-500 dark:text-rose-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No intake responses on file</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
          When the surrogate completes the mobile intake, answers will appear here in organized sections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sectionRows.map(({ section, entries }) => (
        <div
          key={section.id}
          className="overflow-hidden rounded-2xl border border-rose-100/70 bg-white shadow-sm dark:border-white/5 dark:bg-[#15111f]/80"
        >
          <div className="flex items-start gap-4 border-b border-rose-100/60 bg-gradient-to-r from-rose-500/[0.07] via-fuchsia-500/[0.06] to-indigo-500/[0.05] px-5 py-4 dark:border-white/5 dark:from-rose-500/10 dark:via-fuchsia-500/5 dark:to-indigo-500/10">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-rose-500 shadow-sm dark:bg-white/10 dark:text-rose-400">
              <i className={section.icon} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{section.title}</h3>
              {section.subtitle && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{section.subtitle}</p>
              )}
            </div>
            <span className="hidden shrink-0 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 sm:inline">
              {entries.length} {entries.length === 1 ? 'field' : 'fields'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {entries.map(([key, text]) => {
              const long = text.length > 140 || key === 'messageToParents' || text.includes('\n');
              return (
                <div
                  key={key}
                  className={`flex flex-col gap-1.5 rounded-xl border border-gray-100/90 bg-gray-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/[0.03] ${long ? 'sm:col-span-2' : ''}`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-600/80 dark:text-rose-400/90">
                    {formatLabel(key)}
                  </span>
                  <span className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {otherEntries.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-gray-50/50 dark:border-white/5 dark:bg-[#0e0b1a]/60">
          <div className="flex items-center gap-3 border-b border-gray-200/80 px-5 py-3 dark:border-white/5">
            <i className="ri-more-line text-lg text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Additional fields</h3>
            <span className="text-xs text-gray-400">from app / legacy keys</span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {otherEntries.map(([key, text]) => (
              <div
                key={key}
                className={`flex flex-col gap-1.5 rounded-xl border border-gray-200/80 bg-white px-4 py-3 dark:border-white/5 dark:bg-white/[0.02] ${text.includes('\n') ? 'sm:col-span-2' : ''}`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {formatLabel(key)}
                </span>
                <span className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800 dark:text-gray-200">
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
