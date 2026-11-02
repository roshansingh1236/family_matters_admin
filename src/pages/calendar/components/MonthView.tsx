import React, { useMemo } from 'react';
import type { Appointment } from '../../../services/appointmentService';
import DayItemChip from './DayItemChip';
import { buildDayItems, dateKeyOf, groupByDay, isDose, todayKey } from '../calendarUtils';

type Props = {
  month: Date;
  /** Events matching the filters, doses included. */
  events: Appointment[];
  showDoses: boolean;
  onSelectEvent: (event: Appointment) => void;
  onOpenDay: (dateKey: string) => void;
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Lines shown in a day cell before "+N more". */
const MAX_LINES = 3;

const MonthView: React.FC<Props> = ({ month, events, showDoses, onSelectEvent, onOpenDay }) => {
  const byDay = useMemo(() => groupByDay(events), [events]);
  const today = todayKey();

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  return (
    <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-rose-100/60 dark:border-white/5">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="p-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-rose-100/60 dark:border-white/5 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`blank-${index}`} className="min-h-[120px] border-r border-b border-rose-100/60 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.01]" />;
          }
          const key = dateKeyOf(day);
          const dayEvents = byDay.get(key) || [];
          const doseCount = dayEvents.filter(isDose).length;
          const items = buildDayItems(showDoses ? dayEvents : dayEvents.filter((e) => !isDose(e)));
          const visible = items.slice(0, MAX_LINES);
          const hiddenCount = items.length - visible.length;

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay(key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDay(key); } }}
              aria-label={`${day.toDateString()}: ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
              className="min-h-[120px] p-2 border-r border-b border-rose-100/60 dark:border-white/5 [&:nth-child(7n)]:border-r-0 hover:bg-rose-50/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className={`text-sm font-semibold mb-1.5 ${
                key === today
                  ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {visible.map((item) => (
                  <DayItemChip
                    key={item.key}
                    item={item}
                    onSelectEvent={onSelectEvent}
                    onOpenGroup={() => onOpenDay(key)}
                  />
                ))}
                {hiddenCount > 0 && (
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 px-1">+{hiddenCount} more</div>
                )}
                {!showDoses && doseCount > 0 && (
                  <div className="flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-300 px-1">
                    <i className="ri-capsule-line"></i>
                    {doseCount} dose{doseCount === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
