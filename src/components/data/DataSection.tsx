import React from 'react';

type DataSectionProps = {
  title: string;
  data?: Record<string, unknown> | null;
  emptyMessage?: string;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTimestamp = (value: unknown): value is { toDate: () => Date } =>
  typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function';

const formatLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());

const formatValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleString();
  if (isTimestamp(value)) return value.toDate().toLocaleString();
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.map((item, index) => (
          <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
            {formatValue(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return renderEntries(value as Record<string, unknown>, 1);
  }
  return String(value);
};

const PREFERRED_ORDER = [
  'firstname',
  'lastname',
  'name',
  'gender',
  'age',
  'dob',
  'dateofbirth',
  'email',
  'phone',
  'phonenumber',
  'address',
  'city',
  'state',
  'zipcode',
  'zip',
  'country',
  'language',
  'religion',
  'occupation',
  'relationshipstatus',
  'relationshipduration',
  'numberofchildren',
  'needforsurrogateassistance',
  'pastsurrogateexperience',
  'workedwithsurrogatebefore',
  'surrogateselectioncriteria',
  'communicationpreference',
  'contactafterbirth',
  'contactafterbirthexplanation',
  'pregnancyrelationship',
  'attendobappointments',
  'attenddeliveryroom',
  'favoritefood',
  'favoritecolor',
  'favoritemovieshow',
  'hobbiesinterests',
  'relaxationmethod',
  'aboutyourself',
  'personalitydescription',
  'relationshipdescription',
  'relationshipwithchildren',
  'childrenfeelings',
  'tellchildaboutsurrogate',
  'introducesurrogatetochildren',
  'familyfriendsopinion',
  'difficultdecisionreason',
  'additionalinfoforsurrogate',
] as const;

const normalizeKey = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

const sortEntries = (entries: [string, unknown][]) => {
  return [...entries].sort(([keyA], [keyB]) => {
    const normalizedA = normalizeKey(keyA);
    const normalizedB = normalizeKey(keyB);
    const priorityA = PREFERRED_ORDER.indexOf(normalizedA);
    const priorityB = PREFERRED_ORDER.indexOf(normalizedB);
    const safePriorityA = priorityA === -1 ? PREFERRED_ORDER.length : priorityA;
    const safePriorityB = priorityB === -1 ? PREFERRED_ORDER.length : priorityB;
    if (safePriorityA !== safePriorityB) {
      return safePriorityA - safePriorityB;
    }
    return keyA.localeCompare(keyB, undefined, { sensitivity: 'base' });
  });
};

const renderEntries = (data: Record<string, unknown>, depth = 0): React.ReactNode => {
  const entries = sortEntries(Object.entries(data));
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No data available.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map(([key, value]) => {
        const label = formatLabel(key);

        if (isPlainObject(value)) {
          return (
            <div key={key} className="col-span-full space-y-3 mt-4">
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-white/5 pb-2">{label}</h4>
              {renderEntries(value, depth + 1)}
            </div>
          );
        }

        const isUrl = typeof value === 'string' && value.startsWith('http');
        const isUrlArray = Array.isArray(value) && value.length > 0 && typeof value[0] === 'string' && value[0].startsWith('http');

        if (isUrlArray || isUrl) {
            const urls = isUrlArray ? (value as string[]) : [value as string];
            return (
              <div key={key} className="col-span-full space-y-3 mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1 block">
                  {label}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {urls.map((url, i) => {
                      const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
                      const filename = url.split('/').pop()?.split('?')[0] || 'Document';
                      return (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-xl border border-rose-100/30 dark:border-white/5 bg-gray-50/50 dark:bg-[#1a1625] hover:bg-white dark:hover:bg-white/5 shadow-sm hover:shadow-md transition-all group">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'}`}>
                                  <i className={isPdf ? "ri-file-pdf-line text-2xl" : "ri-image-line text-2xl"}></i>
                              </div>
                              <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">View Document {urls.length > 1 ? i + 1 : ''}</p>
                                  <p className="text-[10px] text-gray-500 uppercase mt-1 tracking-wider truncate">{filename}</p>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <i className="ri-external-link-line text-gray-400"></i>
                              </div>
                          </a>
                      );
                  })}
                </div>
              </div>
            );
        }

        const isLongText = typeof value === 'string' && value.length > 60;
        const isArray = Array.isArray(value);

        return (
          <div key={key} className={`flex flex-col p-4 rounded-xl bg-gray-50/50 dark:bg-[#1a1625] border border-rose-100/30 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 transition-all shadow-sm ${isLongText || isArray ? 'col-span-full' : ''}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">
              {label}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white break-words">
              {formatValue(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const DataSection: React.FC<DataSectionProps> = ({ title, data, emptyMessage }) => {
  if (!data || Object.keys(data).length === 0) {
    if (emptyMessage) {
      return (
        <div>
          {title && title.trim().length > 0 && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div>
      {title && title.trim().length > 0 && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      )}
      {renderEntries(data)}
    </div>
  );
};

export default DataSection;

