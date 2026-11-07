import React from 'react';
import type { Appointment } from '../../../services/appointmentService';
import { doseGroupLabel, formatClock, isDose, typeDef } from '../calendarUtils';
import type { DayItem } from '../calendarUtils';

type Props = {
  item: DayItem;
  onSelectEvent: (event: Appointment) => void;
  /** Called for a group of doses (opens the day's full list). */
  onOpenGroup: () => void;
  /** Extra text after the title, e.g. who the event is for. */
  subtitle?: (event: Appointment) => string | undefined;
  size?: 'compact' | 'comfortable';
};

/** One line in a calendar view: an event, or a group of doses at the same time. */
const DayItemChip: React.FC<Props> = ({ item, onSelectEvent, onOpenGroup, subtitle, size = 'compact' }) => {
  const compact = size === 'compact';
  const base = `w-full text-left rounded cursor-pointer text-white hover:opacity-85 shadow-sm truncate ${
    compact ? 'text-xs px-1.5 py-1' : 'text-sm px-3 py-2'
  }`;

  if (item.kind === 'doses') {
    const def = typeDef(item.type);
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenGroup(); }}
        title={`${item.events.length} doses at ${formatClock(item.time)} — click to see who`}
        className={`${base} ${def.color} ring-1 ring-inset ring-white/40`}
      >
        <i className={`${def.icon} mr-1`}></i>
        <span className="font-bold mr-1">{formatClock(item.time)}</span>
        {doseGroupLabel(item.events)}
      </button>
    );
  }

  const ev = item.event;
  const extra = subtitle?.(ev);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }}
      title={`${ev.title}${extra ? ` — ${extra}` : ''}`}
      className={`${base} ${typeDef(ev.type).color}`}
    >
      {isDose(ev) && <i className="ri-repeat-line mr-1" aria-label="Repeats"></i>}
      <span className="font-bold mr-1">{formatClock(item.time)}</span>
      {ev.title}
      {extra && <span className="opacity-80"> · {extra}</span>}
    </button>
  );
};

export default DayItemChip;
