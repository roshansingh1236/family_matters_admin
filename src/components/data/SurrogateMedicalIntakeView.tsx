import React, { useMemo, useState } from 'react';
import Button from '../base/Button';
import EditableJsonSection from './EditableJsonSection';
import {
  flatScreeningEntries,
  infectiousDiseaseFromProfile,
  medicalFitnessFromProfile,
  medicalIntakeProfileSource,
  psychClearanceFromProfile
} from '../../utils/surrogateMedicalFromProfile';
import {
  isImageDoc,
  isMedicalUserDocument,
  normalizeUserDocuments,
  type UserDocumentRecord
} from '../../utils/userDocuments';
import {
  SURROGATE_INFECTIOUS_DISEASE_TEMPLATE,
  SURROGATE_MEDICAL_FITNESS_TEMPLATE,
  SURROGATE_PSYCH_CLEARANCE_TEMPLATE
} from '../../constants/jsonTemplates';

function fmtLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cellVal(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s;
}

type PanelProps = {
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  ring: string;
  fieldKeys: string[];
  template: Record<string, unknown>;
  data: Record<string, unknown> | null;
};

function MedicalPanel({ title, subtitle, icon, accent, ring, fieldKeys, template, data }: PanelProps) {
  const merged: Record<string, unknown> = { ...template, ...(data ?? {}) };
  const hasAny = fieldKeys.some((k) => cellVal(merged[k]).length > 0);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border ${ring} bg-white shadow-lg shadow-rose-500/[0.06] dark:bg-[#12101c] dark:shadow-none`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent} opacity-90`}
        aria-hidden
      />
      <div className="p-6 pt-7">
        <div className="mb-5 flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-md`}
          >
            <i className={`${icon} text-xl`} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        {!hasAny ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No data submitted for this section yet.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-1">
            {fieldKeys.map((key) => {
              const raw = merged[key];
              const text = cellVal(raw);
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-gray-100/80 bg-gray-50/80 px-4 py-3 dark:border-white/5 dark:bg-white/[0.03]"
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {fmtLabel(key)}
                  </dt>
                  <dd className="mt-1 text-sm font-medium leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                    {text.length > 0 ? text : '—'}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </div>
  );
}

function DocumentTile({
  doc,
  large,
  badgeLabel
}: {
  doc: UserDocumentRecord;
  large?: boolean;
  /** If set, shown as corner badge (e.g. category). Omit for no badge. */
  badgeLabel?: string;
}) {
  const url = String(doc.url ?? '');
  const name = String(doc.name ?? 'File');
  const img = isImageDoc(doc);

  if (!url) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-white/10">
        Missing URL
      </div>
    );
  }

  if (img) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group relative block overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 dark:border-white/10 dark:bg-[#1a1625] ${
          large ? 'aspect-video sm:aspect-[4/3]' : 'aspect-square'
        }`}
      >
        <img src={url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="truncate text-xs font-semibold text-white">{name}</p>
          {doc.uploadedAt && (
            <p className="text-[10px] text-white/75">{new Date(String(doc.uploadedAt)).toLocaleString()}</p>
          )}
        </div>
        {badgeLabel ? (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {badgeLabel}
          </span>
        ) : null}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-white/10 dark:bg-[#1a1625] dark:hover:border-emerald-800"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-900/30">
        <i className="ri-file-pdf-line text-2xl" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900 dark:text-white">{name}</p>
        <p className="text-xs text-gray-500">
          {[doc.category, doc.uploadedAt ? new Date(String(doc.uploadedAt)).toLocaleString() : '']
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <i className="ri-external-link-line text-gray-400" />
    </a>
  );
}

type SurrogateMedicalIntakeViewProps = {
  surrogate: Record<string, unknown>;
  onSaveFitness: (v: Record<string, unknown>) => void | Promise<void>;
  onSaveInfectious: (v: Record<string, unknown>) => void | Promise<void>;
  onSavePsych: (v: Record<string, unknown>) => void | Promise<void>;
  onOpenDocumentsTab?: () => void;
};

export default function SurrogateMedicalIntakeView({
  surrogate,
  onSaveFitness,
  onSaveInfectious,
  onSavePsych,
  onOpenDocumentsTab
}: SurrogateMedicalIntakeViewProps) {
  const [showJson, setShowJson] = useState(false);

  const profileSource = useMemo(() => medicalIntakeProfileSource(surrogate), [surrogate]);

  const fitness = useMemo(() => medicalFitnessFromProfile(profileSource), [profileSource]);
  const infectious = useMemo(() => infectiousDiseaseFromProfile(profileSource), [profileSource]);
  const psych = useMemo(() => psychClearanceFromProfile(profileSource), [profileSource]);
  const flatRows = useMemo(() => flatScreeningEntries(profileSource), [profileSource]);

  const allDocs = useMemo(() => normalizeUserDocuments(surrogate.documents), [surrogate.documents]);
  const medicalDocs = useMemo(() => allDocs.filter(isMedicalUserDocument), [allDocs]);

  const fitnessKeys = Object.keys(SURROGATE_MEDICAL_FITNESS_TEMPLATE);
  const infectiousKeys = Object.keys(SURROGATE_INFECTIOUS_DISEASE_TEMPLATE);
  const psychKeys = Object.keys(SURROGATE_PSYCH_CLEARANCE_TEMPLATE);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-rose-100/60 bg-gradient-to-br from-rose-500/[0.12] via-fuchsia-500/[0.08] to-indigo-500/[0.1] p-8 dark:border-white/10 dark:from-rose-500/20 dark:via-fuchsia-500/10 dark:to-indigo-500/15">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-400/25 blur-3xl dark:bg-rose-500/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-xl shadow-rose-500/30">
              <i className="ri-file-shield-2-line text-3xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Medical intake</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Screening answers and uploads from the surrogate app. Panels below merge everything stored under{' '}
                <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs dark:bg-black/30">form_data.surrogate_profile</code>{' '}
                (and optional <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs dark:bg-black/30">medical_screening</code>).
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-white/10 dark:text-rose-300">
                  <i className="ri-smartphone-line" /> Mobile app
                </span>
                {medicalDocs.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <i className="ri-attachment-2" /> {medicalDocs.length} medical file{medicalDocs.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowJson((v) => !v)}>
              <i className={`ri-arrow-${showJson ? 'up' : 'down'}-s-line mr-1`} />
              {showJson ? 'Hide' : 'Show'} JSON editors
            </Button>
            {onOpenDocumentsTab && (
              <Button size="sm" color="blue" onClick={onOpenDocumentsTab}>
                <i className="ri-folder-open-line mr-1" />
                All documents
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <MedicalPanel
          title="Medical fitness"
          subtitle="Exam, history, vitals, clearance"
          icon="ri-heart-pulse-fill"
          accent="from-rose-500 to-pink-600"
          ring="border-rose-100/70 dark:border-rose-900/30"
          fieldKeys={fitnessKeys}
          template={SURROGATE_MEDICAL_FITNESS_TEMPLATE}
          data={fitness}
        />
        <MedicalPanel
          title="Infectious disease"
          subtitle="Screening results (HIV, hepatitis, VDRL, TORCH)"
          icon="ri-virus-line"
          accent="from-violet-500 to-indigo-600"
          ring="border-violet-100/70 dark:border-violet-900/30"
          fieldKeys={infectiousKeys}
          template={SURROGATE_INFECTIOUS_DISEASE_TEMPLATE}
          data={infectious}
        />
        <MedicalPanel
          title="Psychological clearance"
          subtitle="Evaluation status and notes"
          icon="ri-mental-health-line"
          accent="from-cyan-500 to-teal-600"
          ring="border-cyan-100/70 dark:border-cyan-900/30"
          fieldKeys={psychKeys}
          template={SURROGATE_PSYCH_CLEARANCE_TEMPLATE}
          data={psych}
        />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#12101c]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Medical uploads</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Files in the <strong>Medical</strong> category (app uploads use <code className="text-xs">users/…/Medical/…</code>).
            </p>
          </div>
          {allDocs.length > 0 && medicalDocs.length === 0 && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {allDocs.length} file(s) on record — none tagged Medical. Open &quot;All documents&quot; to review.
            </p>
          )}
        </div>
        {medicalDocs.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {medicalDocs.map((doc, i) => (
              <DocumentTile
                key={`${doc.path ?? doc.url}-${i}`}
                doc={doc}
                large={isImageDoc(doc)}
                badgeLabel="Medical"
              />
            ))}
          </div>
        ) : allDocs.length > 0 ? (
          <details className="rounded-2xl border border-amber-100/80 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/20">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200 [&::-webkit-details-marker]:hidden">
              <i className="ri-folder-warning-line mr-2" />
              {allDocs.length} file(s) on profile — none match Medical path/category. Expand to preview all.
            </summary>
            <div className="grid gap-4 border-t border-amber-100/60 p-4 dark:border-amber-900/40 sm:grid-cols-2 lg:grid-cols-3">
              {allDocs.map((doc, i) => (
                <DocumentTile
                  key={`all-${doc.path ?? doc.url}-${i}`}
                  doc={doc}
                  large={isImageDoc(doc)}
                  badgeLabel={String(doc.category || 'File').slice(0, 12)}
                />
              ))}
            </div>
          </details>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <i className="ri-image-add-line mb-2 text-3xl text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No files on this profile yet.</p>
            <p className="mt-1 text-xs text-gray-400">
              App uploads go to the <strong>users</strong> bucket under <code className="text-[10px]">…/Medical/</code> and are listed on the user&apos;s{' '}
              <strong>documents</strong> JSON. Run the DB migration if uploads fail.
            </p>
          </div>
        )}
      </div>

      {flatRows.length > 0 && (
        <details className="group rounded-2xl border border-gray-100 bg-gray-50/50 dark:border-white/10 dark:bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-gray-700 dark:text-gray-200 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <i className="ri-database-2-line text-rose-500" />
              Raw app field names (verbatim)
            </span>
            <i className="ri-arrow-down-s-line transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-gray-100 px-5 py-4 dark:border-white/10">
            <p className="mb-3 text-xs text-gray-500">
              Same values are mapped into the three panels above when possible.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {flatRows.map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-white/60 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0e0b1a]"
                >
                  <span className="font-mono text-xs text-rose-600 dark:text-rose-400">{k}</span>
                  <p className="mt-1 text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      {showJson && (
        <div className="space-y-6 rounded-3xl border border-rose-100/50 bg-white/50 p-6 dark:border-white/10 dark:bg-[#0e0b1a]/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Advanced: edit nested JSON stored under <code className="text-xs">form_data.surrogate_profile</code>.
          </p>
          <EditableJsonSection
            title="Medical Fitness (JSON)"
            data={fitness}
            templateData={SURROGATE_MEDICAL_FITNESS_TEMPLATE}
            onSave={onSaveFitness}
          />
          <EditableJsonSection
            title="Infectious Disease (JSON)"
            data={infectious}
            templateData={SURROGATE_INFECTIOUS_DISEASE_TEMPLATE}
            onSave={onSaveInfectious}
          />
          <EditableJsonSection
            title="Psychological Clearance (JSON)"
            data={psych}
            templateData={SURROGATE_PSYCH_CLEARANCE_TEMPLATE}
            onSave={onSavePsych}
          />
        </div>
      )}
    </div>
  );
}
