import React, { useMemo } from 'react';
import type { Appointment } from '../../../services/appointmentService';
import DayItemChip from './DayItemChip';
import {
  buildDayItems,
  dateKeyOf,
  eventPeople,
  eventTime,
  formatClock,
  groupByDay,
  isDose,
  personLabel,
  todayKey,
} from '../calendarUtils';
import type { Person } from '../calendarUtils';

type Props = {
  /** One day (Day view) or seven (Week view). */
  days: Date[];
  /** Events matching the filters, doses included. */
  events: Appointment[];
  showDoses: boolean;
  people: Record<string, Person>;
  onSelectEvent: (event: Appointment) => void;
  onOpenDay: (dateKey: string) => void;
};

/** Hours always shown, so an empty day still looks like a day. */
const DEFAULT_FIRST_HOUR = 7;
const DEFAULT_LAST_HOUR = 20;
/** Lines per hour cell in the week view before "+N more". */
const WEEK_MAX_LINES = 2;

const hourOf = (ev: Appointment) => Number(eventTime(ev).slice(0, 2));

/**
 * Week / Day view: one row per hour, one column per day. A busy hour stays
 * readable because doses are grouped and week cells cap their lines.
 */
const TimeGridView: React.FC<Props> = ({ days, events, showDoses, people, onSelectEvent, onOpenDay }) => {
  const isDay = days.length === 1;
  const today = todayKey();
  const dayKeys = days.map(dateKeyOf);

  const byDay = useMemo(() => groupByDay(events), [events]);

  // Hour range: the working day, stretched to fit any earlier / later event.
  const hours = useMemo(() => {
    const inView = dayKeys.flatMap((k) => byDay.get(k) || []);
    const shown = inView.filter((e) => showDoses || !isDose(e)).map(hourOf);
    const first = Math.min(DEFAULT_FIRST_HOUR, ...shown);
    const last = Math.max(DEFAULT_LAST_HOUR, ...shown);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [byDay, dayKeys.join(), showDoses]);

  const subtitle = (ev: Appointment) => {
    const names = eventPeople(ev).map((id) => personLabel(people, id));
    return names.length ? names.join(', ') : undefined;
  };

  return (
    <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 overflow-x-auto">
      <div className={isDay ? '' : 'min-w-[760px]'}>
        {/* Day headers */}
        <div className="grid border-b border-rose-100/60 dark:border-white/5" style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d, i) => {
            const key = dayKeys[i];
            const dayEvents = byDay.get(key) || [];
            const doseCount = dayEvents.filter(isDose).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onOpenDay(key)}
                className="p-3 text-center border-l border-rose-100/60 dark:border-white/5 hover:bg-rose-50/60 dark:hover:bg-white/5 cursor-pointer"
              >
                <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  {d.toLocaleDateString(undefined, { weekday: isDay ? 'long' : 'short' })}
                </div>
                <div className={`mx-auto mt-1 text-lg font-bold ${
                  key === today ? 'bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center' : 'text-gray-900 dark:text-white'
                }`}>
                  {d.getDate()}
                </div>
                {!showDoses && doseCount > 0 && (
                  <div className="mt-1 text-xs font-medium text-teal-700 dark:text-teal-300">
                    <i className="ri-capsule-line mr-0.5"></i>{doseCount} dose{doseCount === 1 ? '' : 's'}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Hour rows */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="grid border-b border-rose-100/40 dark:border-white/5 last:border-b-0"
            style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div className="px-2 py-2 text-right text-xs text-gray-500 dark:text-gray-400">
              {formatClock(`${String(hour).padStart(2, '0')}:00`)}
            </div>
            {dayKeys.map((key) => {
              const inHour = (byDay.get(key) || []).filter(
                (e) => hourOf(e) === hour && (showDoses || !isDose(e))
              );
              const items = buildDayItems(inHour);
              const visible = isDay ? items : items.slice(0, WEEK_MAX_LINES);
              const hiddenCount = items.length - visible.length;
              return (
                <div key={key} className={`border-l border-rose-100/60 dark:border-white/5 p-1 space-y-1 ${isDay ? 'min-h-[3.25rem]' : 'min-h-[2.75rem]'}`}>
                  {visible.map((item) => (
                    <DayItemChip
                      key={item.key}
                      item={item}
                      onSelectEvent={onSelectEvent}
                      onOpenGroup={() => onOpenDay(key)}
                      subtitle={isDay ? subtitle : undefined}
                      size={isDay ? 'comfortable' : 'compact'}
                    />
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(key)}
                      className="w-full text-left text-xs font-medium text-gray-600 dark:text-gray-400 px-1 hover:text-rose-500 cursor-pointer"
                    >
                      +{hiddenCount} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimeGridView;
