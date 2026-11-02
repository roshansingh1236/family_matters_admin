import React, { useEffect, useMemo } from 'react';
import type { Appointment } from '../../../services/appointmentService';
import { eventPeople, eventTime, formatClock, isDose, personLabel, typeDef } from '../calendarUtils';
import type { Person } from '../calendarUtils';

type Props = {
  dateKey: string;
  /** That day's events matching the filters, doses always included. */
  events: Appointment[];
  people: Record<string, Person>;
  onClose: () => void;
  onSelectEvent: (event: Appointment) => void;
  onAddEvent: (dateKey: string) => void;
};

const UNASSIGNED = '__unassigned__';

/** Side panel listing everything on one day, grouped by the person it's for. */
const DayPanel: React.FC<Props> = ({ dateKey, events, people, onClose, onSelectEvent, onAddEvent }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [y, m, d] = dateKey.split('-').map(Number);
  const heading = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // An event for several people appears under each of them.
  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const ev of events) {
      const ids = eventPeople(ev);
      for (const id of ids.length ? ids : [UNASSIGNED]) map.set(id, [...(map.get(id) || []), ev]);
    }
    return [...map.entries()]
      .map(([id, list]) => ({
        id,
        name: id === UNASSIGNED ? 'Not assigned to anyone' : personLabel(people, id),
        role: id === UNASSIGNED ? '' : people[id]?.role ?? '',
        events: list.sort((a, b) => eventTime(a).localeCompare(eventTime(b))),
      }))
      .sort((a, b) => (a.id === UNASSIGNED ? 1 : b.id === UNASSIGNED ? -1 : a.name.localeCompare(b.name)));
  }, [events, people]);

  const doseCount = events.filter(isDose).length;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true"></div>
      <aside
        role="dialog"
        aria-label={`Events on ${heading}`}
        className="relative flex h-full w-full max-w-md flex-col bg-white dark:bg-[#15111f] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-white/5 p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{heading}</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {events.length} event{events.length === 1 ? '' : 's'}
              {doseCount > 0 && ` · ${doseCount} medication dose${doseCount === 1 ? '' : 's'}`}
              {groups.length > 0 && ` · ${groups.filter((g) => g.id !== UNASSIGNED).length} people`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer">
            <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nothing scheduled on this day.</p>
          )}
          {groups.map((g) => (
            <section key={g.id}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <i className="ri-user-line text-gray-400"></i>
                {g.name}
                {g.role && <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{g.role}</span>}
              </h3>
              <ul className="space-y-1">
                {g.events.map((ev) => {
                  const def = typeDef(ev.type);
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() => onSelectEvent(ev)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <span className="w-16 flex-shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">{formatClock(eventTime(ev))}</span>
                        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${def.color}`}></span>
                        <span className="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white">
                          {isDose(ev) && <i className="ri-repeat-line mr-1 text-gray-400" aria-label="Repeats"></i>}
                          {ev.title}
                        </span>
                        {ev.status !== 'scheduled' && (
                          <span className="text-xs capitalize text-gray-500">{ev.status}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-t border-gray-100 dark:border-white/5 p-4">
          <button
            type="button"
            onClick={() => onAddEvent(dateKey)}
            className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 cursor-pointer"
          >
            <i className="ri-add-line mr-1"></i>New event on this day
          </button>
        </div>
      </aside>
    </div>
  );
};

export default DayPanel;
