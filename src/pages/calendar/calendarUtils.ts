import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { localDateKey, localTimeValue } from '../../services/appointmentService';
import type { Appointment } from '../../services/appointmentService';

// ─── Event types ─────────────────────────────────────────────────────────────

export type EventTypeDef = { type: string; label: string; color: string; icon: string };

export const EVENT_TYPES: EventTypeDef[] = [
  { type: 'consultation', label: 'Consultations', color: 'bg-blue-500', icon: 'ri-chat-3-line' },
  { type: 'medical', label: 'Medical', color: 'bg-green-500', icon: 'ri-stethoscope-line' },
  { type: 'legal', label: 'Legal', color: 'bg-purple-500', icon: 'ri-scales-3-line' },
  { type: 'psychological', label: 'Psychological', color: 'bg-orange-500', icon: 'ri-mental-health-line' },
  { type: 'medication', label: 'Medication reminders', color: 'bg-teal-500', icon: 'ri-capsule-line' },
  { type: 'injection', label: 'Injection reminders', color: 'bg-rose-500', icon: 'ri-syringe-line' },
  { type: 'reminder', label: 'Other reminders', color: 'bg-amber-500', icon: 'ri-alarm-line' },
  // Anything else, e.g. appointments the app creates with its own types.
  { type: 'other', label: 'Other', color: 'bg-gray-500', icon: 'ri-calendar-line' },
];

const KNOWN_TYPES = new Set(EVENT_TYPES.map((t) => t.type));

/** The filter / colour bucket an event belongs to. */
export const typeKey = (type?: string | null): string => {
  const t = (type || '').toLowerCase();
  return KNOWN_TYPES.has(t) ? t : 'other';
};

export const typeDef = (type?: string | null): EventTypeDef =>
  EVENT_TYPES.find((t) => t.type === typeKey(type))!;

// ─── Event helpers ───────────────────────────────────────────────────────────

/** A dose from a repeating schedule (rather than a one-off event). */
export const isDose = (ev: Appointment): boolean => !!ev.seriesId;

/** The local calendar day of an event, `YYYY-MM-DD`. */
export const eventDayKey = (ev: Appointment): string => localDateKey(ev.startsAt) || ev.date;

/** Local `HH:mm` of an event, for sorting and grouping. */
export const eventTime = (ev: Appointment): string => localTimeValue(ev.startsAt) || '00:00';

export const eventStartMs = (ev: Appointment): number => {
  const ms = Date.parse(ev.startsAt || ev.date);
  return Number.isNaN(ms) ? 0 : ms;
};

/** Everyone the event is for. */
export const eventPeople = (ev: Appointment): string[] =>
  [...new Set([ev.userId, ...(ev.participants || [])].filter((id): id is string => !!id))];

export const dateKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayKey = (): string => dateKeyOf(new Date());

/** The Sunday-to-Saturday week containing [d]. */
export const weekDays = (d: Date): Date[] => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface CalendarFilters {
  /** Only events for this user ('' = everyone). */
  personId: string;
  /** Event types switched off in the legend. */
  hiddenTypes: string[];
  /** Show each dose of a repeating schedule, or only a per-day count. */
  showDoses: boolean;
}

const FILTERS_KEY = 'fms_calendar_filters_v1';

export const DEFAULT_FILTERS: CalendarFilters = { personId: '', hiddenTypes: [], showDoses: true };

export function loadFilters(): CalendarFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      personId: typeof parsed.personId === 'string' ? parsed.personId : '',
      hiddenTypes: Array.isArray(parsed.hiddenTypes) ? parsed.hiddenTypes.filter((t: unknown) => typeof t === 'string') : [],
      showDoses: parsed.showDoses !== false,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(filters: CalendarFilters): void {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* private window or storage blocked: filters just aren't remembered */
  }
}

/** Events matching the person and type filters. Doses are kept; views decide how to show them. */
export function applyFilters(events: Appointment[], filters: CalendarFilters): Appointment[] {
  const hidden = new Set(filters.hiddenTypes);
  return events.filter((ev) => {
    if (hidden.has(typeKey(ev.type))) return false;
    if (filters.personId && !eventPeople(ev).includes(filters.personId)) return false;
    return true;
  });
}

// ─── Grouping ────────────────────────────────────────────────────────────────

export type DayItem =
  | { kind: 'event'; key: string; time: string; event: Appointment }
  | { kind: 'doses'; key: string; time: string; type: string; events: Appointment[] };

/**
 * A day's events in time order, with doses from repeating schedules collapsed
 * into one item per type and time ("08:00 Medication · 6 people").
 */
export function buildDayItems(events: Appointment[]): DayItem[] {
  const items: DayItem[] = [];
  const doseGroups = new Map<string, Appointment[]>();

  for (const ev of events) {
    if (isDose(ev)) {
      const key = `${typeKey(ev.type)}|${eventTime(ev)}`;
      doseGroups.set(key, [...(doseGroups.get(key) || []), ev]);
    } else {
      items.push({ kind: 'event', key: ev.id || `${ev.title}-${ev.startsAt}`, time: eventTime(ev), event: ev });
    }
  }
  for (const [key, group] of doseGroups) {
    // A lone dose reads better as itself.
    if (group.length === 1) {
      const ev = group[0];
      items.push({ kind: 'event', key: ev.id || key, time: eventTime(ev), event: ev });
    } else {
      items.push({ kind: 'doses', key, time: eventTime(group[0]), type: typeKey(group[0].type), events: group });
    }
  }
  return items.sort((a, b) => a.time.localeCompare(b.time));
}

/** "6 people" / "Estrace" for a group of doses. */
export function doseGroupLabel(events: Appointment[]): string {
  const titles = new Set(events.map((e) => e.title));
  const people = new Set(events.flatMap(eventPeople)).size;
  const who = `${people || events.length} ${people === 1 ? 'person' : 'people'}`;
  return titles.size === 1 ? `${events[0].title} · ${who}` : `${typeDef(events[0].type).label} · ${who}`;
}

/** Events grouped by local day. */
export function groupByDay(events: Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  for (const ev of events) {
    const key = eventDayKey(ev);
    map.set(key, [...(map.get(key) || []), ev]);
  }
  return map;
}

/** "12:30 PM" for an `HH:mm` value. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ─── People ──────────────────────────────────────────────────────────────────

export type Person = { id: string; name: string; role: string };

function displayName(u: Record<string, any>): string {
  const fd = (u.form_data && typeof u.form_data === 'object' ? u.form_data : {}) as Record<string, any>;
  const name =
    [u.first_name, u.last_name].filter(Boolean).join(' ') ||
    [fd.firstName, fd.lastName].filter(Boolean).join(' ') ||
    u.parent1?.name ||
    fd.parent1?.name ||
    u.email;
  return name || 'Unknown user';
}

/** Names of every user, for labels and grouping by person. Loaded once. */
export function usePeople(): Record<string, Person> {
  const [people, setPeople] = useState<Record<string, Person>>({});
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('users')
      // `*` rather than a column list: older rows keep names in different
      // places, and naming a column a database lacks fails the whole query.
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load user names', error);
          return;
        }
        if (cancelled) return;
        const map: Record<string, Person> = {};
        for (const u of data || []) map[u.id] = { id: u.id, name: displayName(u), role: u.role || 'User' };
        setPeople(map);
      });
    return () => { cancelled = true; };
  }, []);
  return people;
}

export const personLabel = (people: Record<string, Person>, id: string): string =>
  people[id]?.name ?? 'Loading...';
