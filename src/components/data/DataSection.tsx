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

const renderEntries = (data: Record<string, unknown>, depth = 0): React.ReactNode => {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No data available.</p>;
  }

  return (
    <div className={`space-y-3 ${depth > 0 ? 'pl-4 border-l border-gray-200 dark:border-gray-700' : ''}`}>
      {entries.map(([key, value]) => {
        const label = formatLabel(key);

        if (isPlainObject(value)) {
          return (
            <div key={key} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
              {renderEntries(value, depth + 1)}
            </div>
          );
        }

        return (
          <div key={key} className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </span>
            <span className="text-sm text-gray-900 dark:text-white break-words">{formatValue(value)}</span>
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

