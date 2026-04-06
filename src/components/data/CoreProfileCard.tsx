import React, { useMemo } from 'react';
import EditableJsonSection from './EditableJsonSection';
import { CORE_PROFILE_TEMPLATE } from '../../constants/jsonTemplates';

type FieldKey =
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'profileCompleted'
  | 'form2Completed'
  | 'profileCompletedAt'
  | 'form2CompletedAt';

const FIELD_CONFIG: Record<
  FieldKey,
  { label: string; icon: string; wide?: boolean }
> = {
  firstName: { label: 'First name', icon: 'ri-user-smile-line' },
  lastName: { label: 'Last name', icon: 'ri-user-line' },
  role: { label: 'Role', icon: 'ri-shield-user-line' },
  profileCompleted: { label: 'Profile completed', icon: 'ri-checkbox-circle-line' },
  form2Completed: { label: 'Form 2 completed', icon: 'ri-file-list-3-line' },
  profileCompletedAt: { label: 'Profile completed at', icon: 'ri-calendar-schedule-line', wide: true },
  form2CompletedAt: { label: 'Form 2 completed at', icon: 'ri-time-line', wide: true }
};

const ORDER: FieldKey[] = [
  'firstName',
  'lastName',
  'role',
  'profileCompleted',
  'form2Completed',
  'profileCompletedAt',
  'form2CompletedAt'
];

function formatDisplayValue(key: string, value: unknown): React.ReactNode {
  if (value === undefined || value === null || value === '') {
    return <span className="text-gray-400 dark:text-gray-500">—</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
          value
            ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
            : 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
        }`}
      >
        <i className={value ? 'ri-check-line' : 'ri-close-line'} />
        {value ? 'Yes' : 'No'}
      </span>
    );
  }
  if (typeof value === 'string') {
    const isLikelyIso =
      /^\d{4}-\d{2}-\d{2}/.test(value) && (value.includes('T') || value.includes(':'));
    if (isLikelyIso) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return (
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {d.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}
          </span>
        );
      }
    }
    return <span className="text-gray-900 dark:text-gray-100">{value}</span>;
  }
  return <span className="text-gray-900 dark:text-gray-100">{String(value)}</span>;
}

type Props = {
  /** Core field values (camelCase keys matching CORE_PROFILE_TEMPLATE) */
  data: Record<string, unknown>;
  onSave: (value: Record<string, unknown>) => Promise<void> | void;
  /** Field keys to show (default: full core set) */
  fieldOrder?: readonly string[];
  title?: string;
  subtitle?: string;
};

export default function CoreProfileCard({
  data,
  onSave,
  fieldOrder = ORDER as readonly string[],
  title = 'Core profile',
  subtitle = 'Account flags and completion times synced with the mobile app and database.'
}: Props) {
  const jsonData = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const k of fieldOrder) {
      o[k] = data[k];
    }
    return o;
  }, [data, fieldOrder]);

  return (
    <div className="overflow-hidden rounded-2xl border border-rose-100/70 bg-white shadow-md shadow-rose-500/5 dark:border-white/5 dark:bg-[#15111f]/90 dark:shadow-none">
      <div className="relative overflow-hidden border-b border-rose-100/60 bg-gradient-to-r from-indigo-500/[0.07] via-rose-500/[0.08] to-fuchsia-500/[0.06] px-6 py-5 dark:border-white/5 dark:from-indigo-500/15 dark:via-rose-500/12 dark:to-fuchsia-500/10">
        <div className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-fuchsia-400/15 blur-2xl dark:bg-fuchsia-500/10" />
        <div className="relative flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-rose-500 text-white shadow-lg shadow-rose-500/25">
              <i className="ri-id-card-line text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
              <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
        {fieldOrder.map((key) => {
          const meta = FIELD_CONFIG[key as FieldKey];
          if (!meta) return null;
          const val = data[key];
          const wide = meta.wide;
          return (
            <div
              key={key}
              className={`flex gap-3 rounded-xl border border-gray-100/90 bg-gradient-to-br from-gray-50/90 to-white px-4 py-3.5 dark:border-white/5 dark:from-white/[0.04] dark:to-[#0e0b1a]/40 ${wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-lg text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                <i className={meta.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {meta.label}
                </p>
                <div className="mt-1 text-sm leading-snug">{formatDisplayValue(key, val)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <details className="group border-t border-rose-100/50 bg-gray-50/40 dark:border-white/5 dark:bg-[#0e0b1a]/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-4 text-sm font-semibold text-indigo-600 transition hover:bg-white/60 dark:text-indigo-400 dark:hover:bg-white/5 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <i className="ri-code-s-slash-line text-lg" />
            Edit as JSON (admin)
          </span>
          <i className="ri-arrow-down-s-line text-lg transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-rose-100/40 px-5 pb-6 pt-2 dark:border-white/5">
          <EditableJsonSection
            title="Core profile JSON"
            description="Maps to users.first_name, profile_completed, form_2_completed_at, etc. when saved."
            data={jsonData}
            templateData={CORE_PROFILE_TEMPLATE}
            onSave={onSave}
          />
        </div>
      </details>
    </div>
  );
}
