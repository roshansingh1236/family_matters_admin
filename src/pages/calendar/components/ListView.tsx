import React, { useMemo, useState } from 'react';
import Badge from '../../../components/base/Badge';
import type { Appointment } from '../../../services/appointmentService';
import {
  buildDayItems,
  doseGroupLabel,
  eventPeople,
  formatClock,
  groupByDay,
  isDose,
  personLabel,
  todayKey,
  typeDef,
} from '../calendarUtils';
import type { Person } from '../calendarUtils';

type Props = {
  /** Events matching the filters, doses included. */
  events: Appointment[];
  showDoses: boolean;
  people: Record<string, Person>;
  onSelectEvent: (event: Appointment) => void;
};

/** Days with events shown per page. */
const PAGE_DAYS = 30;

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed': return <Badge color="gray">Completed</Badge>;
    case 'cancelled': return <Badge color="red">Cancelled</Badge>;
    default: return <Badge color="blue">Scheduled</Badge>;
  }
};

const dayHeading = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = todayKey();
  const label = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return key === today ? `Today · ${label}` : label;
};

/** Agenda of events by day: upcoming by default, past on request. */
const ListView: React.FC<Props> = ({ events, showDoses, people, onSelectEvent }) => {
  const [includePast, setIncludePast] = useState(false);
  const [pages, setPages] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const dayGroups = useMemo(() => {
    const today = todayKey();
    const byDay = groupByDay(events.filter((e) => showDoses || !isDose(e)));
    return [...byDay.entries()]
      .filter(([key]) => includePast || key >= today)
      // Upcoming: soonest first. With past included: most recent first.
      .sort(([a], [b]) => (includePast ? b.localeCompare(a) : a.localeCompare(b)));
  }, [events, showDoses, includePast]);

  const shown = dayGroups.slice(0, pages * PAGE_DAYS);
  const names = (ev: Appointment) => eventPeople(ev).map((id) => personLabel(people, id)).join(', ');

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {dayGroups.length === 0
            ? 'Nothing to show.'
            : `${dayGroups.length} day${dayGroups.length === 1 ? '' : 's'} with events`}
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includePast}
            onChange={(e) => { setIncludePast(e.target.checked); setPages(1); }}
            className="h-4 w-4 rounded border-gray-300 dark:border-white/20 accent-rose-500"
          />
          Include past events
        </label>
      </div>

      {dayGroups.length === 0 && (
        <div className="text-center py-12">
          <i className="ri-calendar-check-line text-5xl text-gray-300 dark:text-gray-600"></i>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {includePast ? 'No events match the filters.' : 'No upcoming events match the filters.'}
          </p>
        </div>
      )}

      {shown.map(([dayKey, dayEvents]) => (
        <section key={dayKey}>
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{dayHeading(dayKey)}</h3>
          <div className="divide-y divide-gray-100 dark:divide-white/5 rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#15111f]">
            {buildDayItems(dayEvents).map((item) => {
              if (item.kind === 'doses') {
                const def = typeDef(item.type);
                const groupKey = `${dayKey}|${item.key}`;
                const open = expanded.has(groupKey);
                return (
                  <div key={item.key}>
                    <button
                      type="button"
                      onClick={() => toggle(groupKey)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <span className="w-20 flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">{formatClock(item.time)}</span>
                      <span className={`h-3 w-3 flex-shrink-0 rounded-full ${def.color}`}></span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-gray-900 dark:text-white truncate">
                          <i className={`${def.icon} mr-1`}></i>{doseGroupLabel(item.events)}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {item.events.length} doses from repeating schedules
                        </span>
                      </span>
                      <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line text-gray-400`}></i>
                    </button>
                    {open && (
                      <ul className="pb-2">
                        {item.events.map((ev) => (
                          <li key={ev.id}>
                            <button
                              type="button"
                              onClick={() => onSelectEvent(ev)}
                              className="flex w-full items-center gap-3 py-1.5 pl-[7.25rem] pr-4 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                            >
                              <i className="ri-user-line text-xs text-gray-400"></i>
                              <span className="flex-1 truncate">{names(ev) || 'No one assigned'}</span>
                              <span className="truncate text-xs text-gray-500">{ev.title}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }

              const ev = item.event;
              const def = typeDef(ev.type);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectEvent(ev)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <span className="w-20 flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">{formatClock(item.time)}</span>
                  <span className={`h-3 w-3 flex-shrink-0 rounded-full ${def.color}`}></span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-gray-900 dark:text-white truncate">
                      {isDose(ev) && <i className="ri-repeat-line mr-1 text-gray-400" aria-label="Repeats"></i>}
                      {ev.title}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                      {[def.label, names(ev), ev.location].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {statusBadge(ev.status)}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {shown.length < dayGroups.length && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setPages((p) => p + 1)}
            className="rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
          >
            Show more days
          </button>
        </div>
      )}
    </div>
  );
};

export default ListView;
