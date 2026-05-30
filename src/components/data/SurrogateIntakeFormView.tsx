import React, { useEffect, useMemo, useState } from 'react';
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

const BOOLEAN_KEYS = new Set([
  'receivedVaccination',
  'openToVaccination',
  'hasTransportation',
  'canTravelForIVF',
  'hasFlexibleSchedule',
  'hasCustody',
  'hasCollegeDegree',
  'isEmployed',
  'partnerEmployed',
  'regularCycles',
  'onBirthControl',
  'isBreastfeeding',
  'usedTHC',
  'postpartumDepression',
  'bedrest',
  'hepatitisBVaccination',
  'rhogamInjection',
  'fertilityTreatments',
  'hadMiscarriage',
  'understandsAppointments',
  'allowOBAppointments',
  'allowDeliveryRoom',
  'helpCoupleWithChildren',
  'helpSameSexCouple',
  'helpSingleParent',
  'reduceTripletsToTwins',
  'reduceTwinsToSingleton',
  'terminateIfNecessary',
  'terminateDownSyndrome',
  'amniocentesis',
  'agreeToFetalTesting',
  'willingForSplitTwins',
  'smoker'
]);

const NUMERIC_KEYS = new Set([
  'weight',
  'age',
  'bmi',
  'yearsTogether',
  'childrenBirthed',
  'surrogacyChildren',
  'numberOfPregnancies',
  'pregnancy1Weight',
  'pregnancy2Weight',
  'pregnancy3Weight'
]);

const DATE_KEYS = new Set([
  'dob',
  'lastPapSmear',
  'pregnancy1DOB',
  'pregnancy2DOB',
  'pregnancy3DOB'
]);

const LONG_TEXT_KEYS = new Set([
  'messageToParents',
  'surrogacyReasons',
  'surrogacyExcitement',
  'childhoodMemory',
  'hobbies',
  'personality',
  'additionalPregnancyInfo',
  'miscarriageDetails'
]);

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

const formatHeight = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  
  const num = Number(str);
  if (!isNaN(num) && num > 0 && num < 120) {
    const feet = Math.floor(num / 12);
    const inches = Math.round(num % 12);
    return `${feet}ft ${inches}inches`;
  }
  return str;
};

const formatValue = (value: unknown, key?: string): string => {
  if (isEmpty(value)) return '';
  if (key === 'height') {
    return formatHeight(value);
  }
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
  if (Array.isArray(value)) return value.map((x) => formatValue(x, key)).filter(Boolean).join(', ');
  return JSON.stringify(value);
};

const allSectionKeys = new Set(SECTIONS.flatMap((s) => s.keys));

type Props = {
  data: Record<string, unknown> | null | undefined;
  onSaveField?: (key: string, value: unknown) => Promise<void> | void;
  readOnly?: boolean;
};

type FieldEditorProps = {
  fieldKey: string;
  rawValue: unknown;
  displayValue: string;
  onSave: (value: unknown) => Promise<void> | void;
  variant?: 'section' | 'other';
};

function FieldEditor({ fieldKey, rawValue, displayValue, onSave, variant = 'section' }: FieldEditorProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialString = useMemo(() => {
    if (rawValue === null || rawValue === undefined) return '';
    if (typeof rawValue === 'boolean') return rawValue ? 'true' : 'false';
    if (Array.isArray(rawValue)) return rawValue.join(', ');
    if (typeof rawValue === 'object') return JSON.stringify(rawValue, null, 2);
    return String(rawValue);
  }, [rawValue]);
  const [draft, setDraft] = useState(initialString);

  useEffect(() => {
    if (!editing) setDraft(initialString);
  }, [editing, initialString]);

  const isBool = BOOLEAN_KEYS.has(fieldKey);
  const isNum = NUMERIC_KEYS.has(fieldKey);
  const isDate = DATE_KEYS.has(fieldKey);
  const isLong = LONG_TEXT_KEYS.has(fieldKey);

  const beginEdit = () => {
    setDraft(initialString);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(initialString);
  };

  const parsed = (): unknown => {
    if (isBool) return draft === 'true';
    if (isNum) {
      const t = draft.trim();
      if (t === '') return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : draft;
    }
    if (isDate) {
      // accept YYYY-MM-DD as-is
      return draft.trim() || null;
    }
    return draft;
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(parsed());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const labelCls = variant === 'section'
    ? 'text-[11px] font-semibold uppercase tracking-wide text-rose-600/80 dark:text-rose-400/90'
    : 'text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500';

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <span className={labelCls}>{formatLabel(fieldKey)}</span>
        {isBool ? (
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm rounded-lg border border-rose-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-2 py-1.5 text-gray-900 dark:text-gray-100"
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ) : isLong ? (
          <textarea
            value={draft}
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm rounded-lg border border-rose-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-2 py-1.5 text-gray-900 dark:text-gray-100"
          />
        ) : (
          <input
            type={isNum ? 'number' : isDate ? 'date' : 'text'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm rounded-lg border border-rose-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-2 py-1.5 text-gray-900 dark:text-gray-100"
          />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="px-3 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 group">
      <div className="flex items-center justify-between gap-2">
        <span className={labelCls}>{formatLabel(fieldKey)}</span>
        <button
          type="button"
          onClick={beginEdit}
          className="text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Edit ${formatLabel(fieldKey)}`}
        >
          <i className="ri-edit-line"></i> Edit
        </button>
      </div>
      <span className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 dark:text-gray-100">
        {displayValue || <span className="text-gray-400 italic">— empty —</span>}
      </span>
    </div>
  );
}

export default function SurrogateIntakeFormView({ data, onSaveField, readOnly = false }: Props) {
  const editable = !readOnly && typeof onSaveField === 'function';

  const { sectionRows, otherEntries, hasAny } = useMemo(() => {
    if (!data || typeof data !== 'object') {
      return { sectionRows: [] as { section: SectionDef; entries: [string, unknown, string][] }[], otherEntries: [] as [string, unknown, string][], hasAny: false };
    }

    const used = new Set<string>();
    const sectionRows: { section: SectionDef; entries: [string, unknown, string][] }[] = [];

    for (const section of SECTIONS) {
      const entries: [string, unknown, string][] = [];
      for (const key of section.keys) {
        const raw = data[key];
        if (raw !== undefined && raw !== null && typeof raw === 'object' && !Array.isArray(raw)) continue;
        const text = formatValue(raw, key);
        // When editable, include all fields so admin can fill empty ones too
        if (!text && !editable) continue;
        entries.push([key, raw, text]);
        used.add(key);
      }
      if (entries.length > 0) sectionRows.push({ section, entries });
    }

    // If editable and a section had no data, still surface it so admins can fill it in
    if (editable) {
      for (const section of SECTIONS) {
        const hasSection = sectionRows.some((s) => s.section.id === section.id);
        if (hasSection) continue;
        const entries: [string, unknown, string][] = section.keys.map((k) => [k, data[k], formatValue(data[k], k)]);
        sectionRows.push({ section, entries });
      }
    }

    const otherEntries: [string, unknown, string][] = [];
    for (const key of Object.keys(data)) {
      if (used.has(key) || allSectionKeys.has(key)) continue;
      if (SKIP_OTHER_KEYS.has(key)) continue;
      const raw = data[key];
      if (raw !== undefined && raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        otherEntries.push([key, raw, JSON.stringify(raw, null, 2)]);
        continue;
      }
      const text = formatValue(raw, key);
      if (text) otherEntries.push([key, raw, text]);
    }

    otherEntries.sort(([a], [b]) => a.localeCompare(b));

    const hasAny = sectionRows.length > 0 || otherEntries.length > 0;
    return { sectionRows, otherEntries, hasAny };
  }, [data, editable]);

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
            {entries.map(([key, raw, text]) => {
              const long = text.length > 140 || key === 'messageToParents' || text.includes('\n') || LONG_TEXT_KEYS.has(key);
              return (
                <div
                  key={key}
                  className={`flex flex-col gap-1.5 rounded-xl border border-gray-100/90 bg-gray-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/[0.03] ${long ? 'sm:col-span-2' : ''}`}
                >
                  {editable ? (
                    <FieldEditor
                      fieldKey={key}
                      rawValue={raw}
                      displayValue={text}
                      onSave={(v) => onSaveField!(key, v)}
                      variant="section"
                    />
                  ) : (
                    <>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-600/80 dark:text-rose-400/90">
                        {formatLabel(key)}
                      </span>
                      <span className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                        {text}
                      </span>
                    </>
                  )}
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
            {otherEntries.map(([key, raw, text]) => {
              const isPhotosKey = key.toLowerCase().includes('photo');
              const urls = isPhotosKey && text.includes('http')
                ? text.split(',').map((u) => u.trim()).filter((u) => u.startsWith('http'))
                : [];

              return (
                <div
                  key={key}
                  className={`flex flex-col gap-1.5 rounded-xl border border-gray-200/80 bg-white px-4 py-3 dark:border-white/5 dark:bg-white/[0.02] ${text.includes('\n') || urls.length > 0 ? 'sm:col-span-2' : ''}`}
                >
                  {urls.length > 0 ? (
                    <>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {formatLabel(key)}
                      </span>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="group block h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm dark:border-white/10 dark:bg-gray-800 sm:h-24 sm:w-24">
                            <img src={url} alt={`${formatLabel(key)} ${i + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                          </a>
                        ))}
                      </div>
                    </>
                  ) : editable ? (
                    <FieldEditor
                      fieldKey={key}
                      rawValue={raw}
                      displayValue={text}
                      onSave={(v) => onSaveField!(key, v)}
                      variant="other"
                    />
                  ) : (
                    <>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {formatLabel(key)}
                      </span>
                      <span className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800 dark:text-gray-200">
                        {text}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
