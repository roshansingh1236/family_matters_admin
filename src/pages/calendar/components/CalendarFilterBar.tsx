import React from 'react';
import UserSelector from '../../../components/feature/UserSelector';
import { DEFAULT_FILTERS, EVENT_TYPES } from '../calendarUtils';
import type { CalendarFilters } from '../calendarUtils';

type Props = {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
};

const CalendarFilterBar: React.FC<Props> = ({ filters, onChange }) => {
  const update = (changes: Partial<CalendarFilters>) => onChange({ ...filters, ...changes });
  const isFiltered =
    filters.personId !== '' || filters.hiddenTypes.length > 0 || filters.showDoses !== DEFAULT_FILTERS.showDoses;

  const toggleType = (type: string) =>
    update({
      hiddenTypes: filters.hiddenTypes.includes(type)
        ? filters.hiddenTypes.filter((t) => t !== type)
        : [...filters.hiddenTypes, type],
    });

  return (
    <div className="mb-6 rounded-2xl border border-rose-100/60 dark:border-white/5 bg-white dark:bg-[#15111f] p-4 space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="md:w-80">
          {/* Remount when cleared so the search box empties too. */}
          <UserSelector
            key={filters.personId === '' ? 'all' : 'person'}
            value={filters.personId}
            onChange={(personId) => update({ personId })}
            label="Show events for"
            placeholder="Everyone — search a surrogate or parent..."
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none md:pb-2">
          <button
            type="button"
            role="switch"
            aria-checked={filters.showDoses}
            onClick={() => update({ showDoses: !filters.showDoses })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors cursor-pointer ${
              filters.showDoses ? 'bg-rose-500' : 'bg-gray-300 dark:bg-white/20'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                filters.showDoses ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span>
            Show medication doses
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {filters.showDoses ? 'Doses from repeating schedules are grouped by time.' : 'Only a count of doses is shown on each day.'}
            </span>
          </span>
        </label>

        {isFiltered && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-sm font-medium text-rose-500 hover:text-rose-600 cursor-pointer md:ml-auto md:pb-2"
          >
            <i className="ri-filter-off-line mr-1"></i>Clear filters
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Event types">
        {EVENT_TYPES.map((t) => {
          const on = !filters.hiddenTypes.includes(t.type);
          return (
            <button
              key={t.type}
              type="button"
              aria-pressed={on}
              onClick={() => toggleType(t.type)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                on
                  ? 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-800 dark:text-gray-200'
                  : 'border-dashed border-gray-300 dark:border-white/10 text-gray-400 dark:text-gray-500 line-through'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${on ? t.color : 'bg-gray-300 dark:bg-white/20'}`}></span>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarFilterBar;
