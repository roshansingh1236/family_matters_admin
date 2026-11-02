
import { supabase } from '../lib/supabase';
import { pushService } from './pushService';
import { emailService } from './emailService';

export interface Appointment {
  id?: string;
  title: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  participants: string[];
  userIds?: string[];
  userId?: string; 
  caseId?: string;
  location: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Exact start of the event (ISO timestamp, UTC) as stored. */
  startsAt?: string;
  /** The repeating schedule this event belongs to, if any. */
  seriesId?: string | null;
}

const TABLE_NAME = 'appointments';
const REMINDERS_TABLE = 'appointment_reminders';
const SERIES_TABLE = 'appointment_series';

// ─── Reminders ───────────────────────────────────────────────────────────────
// Event types that are a reminder for the user to do something (take a
// medication, give an injection, ...) rather than a meeting.
export const REMINDER_EVENT_TYPES = ['medication', 'injection', 'reminder'] as const;

export const isReminderEventType = (type?: string | null): boolean =>
  (REMINDER_EVENT_TYPES as readonly string[]).includes((type || '').toLowerCase());

/** When a push reminder can go out, relative to the event's start. */
export const REMINDER_LEAD_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 1440, label: '1 day before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 0, label: 'At the scheduled time' },
];

export const reminderLeadLabel = (minutes: number): string =>
  REMINDER_LEAD_OPTIONS.find((o) => o.minutes === minutes)?.label ?? `${minutes} min before`;

export type ReminderRow = {
  appointment_id: string;
  user_id: string;
  remind_at: string;
  lead_minutes: number;
};

/**
 * The reminder rows an event should have: one per user per lead time, skipping
 * any whose moment has already passed.
 */
export function buildReminderRows(
  appointmentId: string,
  startsAt: string,
  userIds: (string | null | undefined)[],
  leadMinutes: number[],
  now: Date = new Date(),
): ReminderRow[] {
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return [];

  const users = [...new Set(userIds.filter((u): u is string => !!u))];
  const leads = [...new Set(leadMinutes.filter((m) => Number.isFinite(m) && m >= 0))];

  const rows: ReminderRow[] = [];
  for (const userId of users) {
    for (const lead of leads) {
      const remindAt = start - lead * 60 * 1000;
      if (remindAt <= now.getTime()) continue;
      rows.push({
        appointment_id: appointmentId,
        user_id: userId,
        remind_at: new Date(remindAt).toISOString(),
        lead_minutes: lead,
      });
    }
  }
  return rows;
}

/** `YYYY-MM-DD` of an ISO timestamp in the viewer's own time zone. */
export function localDateKey(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 24-hour `HH:mm` of an ISO timestamp in the viewer's own time zone. */
export function localTimeValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Repeating schedules ─────────────────────────────────────────────────────
// A repeating schedule is saved as one appointments row per occurrence (so the
// app calendar and the push reminders need nothing new), tied together by an
// appointment_series row that keeps the rule for editing.

export type RecurrenceFrequency = 'daily' | 'interval' | 'weekly';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  /** Every N days (frequency = 'interval'). */
  interval?: number;
  /** 0 = Sunday … 6 = Saturday (frequency = 'weekly'). */
  weekdays?: number[];
  /** `YYYY-MM-DD`, first day the schedule may run. */
  startDate: string;
  /** `YYYY-MM-DD`, last day (inclusive). Either this or [count]. */
  endDate?: string;
  /** Number of days with an occurrence. Either this or [endDate]. */
  count?: number;
  /** `HH:mm` times on each of those days. */
  times: string[];
  /** The admin's time zone when the occurrences were generated. */
  timeZone?: string;
}

export interface SeriesMedicine {
  name: string;
  dose: string;
}

export interface SeriesInput {
  title: string;
  type: string;
  location?: string;
  notes?: string;
  userId?: string;
  participants: string[];
  medicines: SeriesMedicine[];
  recurrence: Recurrence;
  reminderLeads: number[];
}

/** Longest schedule we generate, as a guard against a mistyped end date. */
export const MAX_SERIES_DAYS = 366;
export const MAX_SERIES_OCCURRENCES = 500;

const parseLocalDate = (key: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const dateKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The days a schedule runs on, as `YYYY-MM-DD` in the admin's time zone. */
export function recurrenceDays(rec: Recurrence): string[] {
  const start = parseLocalDate(rec.startDate);
  if (!start) return [];
  const end = rec.endDate ? parseLocalDate(rec.endDate) : null;
  const wantCount = rec.count && rec.count > 0 ? Math.floor(rec.count) : null;
  if (!end && !wantCount) return [];

  const interval = Math.max(1, Math.floor(rec.interval || 1));
  const weekdays = new Set(rec.weekdays || []);
  const days: string[] = [];

  for (let i = 0; i < MAX_SERIES_DAYS; i++) {
    // Calendar arithmetic (not +24h) so DST changes never skip or repeat a day.
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (end && day > end) break;
    const runs =
      rec.frequency === 'weekly' ? weekdays.has(day.getDay())
      : rec.frequency === 'interval' ? i % interval === 0
      : true;
    if (runs) {
      days.push(dateKeyOf(day));
      if (wantCount && days.length >= wantCount) break;
    }
  }
  return days;
}

/** Every occurrence of a schedule as an ISO timestamp, in order. */
export function expandRecurrence(rec: Recurrence): string[] {
  const times = [...new Set(rec.times.filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort();
  const out: string[] = [];
  for (const day of recurrenceDays(rec)) {
    for (const time of times) {
      const d = new Date(`${day}T${time}`);
      if (!Number.isNaN(d.getTime())) out.push(d.toISOString());
    }
  }
  return out;
}

/** Why a schedule can't be saved, or null if it can. */
export function recurrenceProblem(rec: Recurrence): string | null {
  if (!parseLocalDate(rec.startDate)) return 'Choose a start date.';
  if (rec.times.filter(Boolean).length === 0) return 'Add at least one time of day.';
  if (rec.frequency === 'weekly' && !(rec.weekdays && rec.weekdays.length)) {
    return 'Pick at least one day of the week.';
  }
  if (rec.frequency === 'interval' && !(rec.interval && rec.interval >= 2)) {
    return 'Enter how many days apart (2 or more).';
  }
  if (rec.endDate) {
    const start = parseLocalDate(rec.startDate)!;
    const end = parseLocalDate(rec.endDate);
    if (!end || end < start) return 'The end date must be on or after the start date.';
    if ((end.getTime() - start.getTime()) / 86400000 >= MAX_SERIES_DAYS) {
      return `A schedule can run for up to ${MAX_SERIES_DAYS} days.`;
    }
  } else if (!(rec.count && rec.count >= 1)) {
    return 'Enter how many days the schedule runs.';
  } else if (rec.count > MAX_SERIES_DAYS) {
    return `A schedule can run for up to ${MAX_SERIES_DAYS} days.`;
  }
  const total = expandRecurrence(rec).length;
  if (total === 0) return 'This schedule has no days in it. Check the dates and days of the week.';
  if (total > MAX_SERIES_OCCURRENCES) {
    return `This schedule would create ${total} events; the limit is ${MAX_SERIES_OCCURRENCES}. Shorten it or use fewer times per day.`;
  }
  return null;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One-line summary, e.g. "Every day at 08:00, 20:00 · Nov 1 – Nov 21". */
export function describeRecurrence(rec: Recurrence): string {
  const repeat =
    rec.frequency === 'weekly'
      ? `Every ${[...(rec.weekdays || [])].sort().map((d) => WEEKDAY_NAMES[d]).join(', ')}`
      : rec.frequency === 'interval'
        ? `Every ${rec.interval} days`
        : 'Every day';
  const days = recurrenceDays(rec);
  const fmt = (key: string) =>
    parseLocalDate(key)?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) ?? key;
  const range = days.length ? ` · ${fmt(days[0])} – ${fmt(days[days.length - 1])}` : '';
  return `${repeat} at ${[...rec.times].sort().join(', ')}${range}`;
}

/** "Estrace 2 mg, Progesterone in oil 1 mL" */
export function medicinesSummary(medicines: SeriesMedicine[]): string {
  return medicines
    .map((m) => [m.name.trim(), m.dose.trim()].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(', ');
}

/**
 * The event description: the medicines first (the push reminder shows the
 * start of the description), then the admin's notes.
 */
export function eventDescription(medicines: SeriesMedicine[], notes?: string): string {
  const summary = medicinesSummary(medicines);
  return [summary ? `Take: ${summary}` : '', (notes || '').trim()].filter(Boolean).join('\n');
}

/** DB CHECK: status IN ('Scheduled', 'Completed', 'Cancelled') — UI uses lowercase */
function toDbStatus(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'Completed';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  return 'Scheduled';
}

function fromDbStatus(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'scheduled') return 'scheduled';
  return 'scheduled';
}

/** Associated user is stored as user_id; UI lists participants — merge so both show up */
function mergeParticipantIds(row: { participants?: string[] | null; user_id?: string | null }): string[] {
  const fromCol = Array.isArray(row.participants) ? row.participants.filter(Boolean) : [];
  const uid = row.user_id;
  return [...new Set([...fromCol, ...(uid ? [uid] : [])])];
}

function seriesRow(input: SeriesInput, primaryUserId: string | null, participantIds: string[]) {
  return {
    title: input.title,
    type: input.type,
    description: input.notes || null,
    location: input.location || null,
    user_id: primaryUserId,
    participants: participantIds,
    medications: input.medicines.filter((m) => m.name.trim()),
    recurrence: input.recurrence,
    reminder_leads: [...new Set(input.reminderLeads)],
  };
}

/**
 * Insert a series' occurrences that start after [from], plus their push
 * reminders. Rows go in batches to keep each request small.
 */
async function insertOccurrences(
  seriesId: string,
  input: SeriesInput,
  primaryUserId: string | null,
  participantIds: string[],
  from: Date,
): Promise<{ occurrences: number; remindersScheduled: number }> {
  const starts = expandRecurrence(input.recurrence).filter((iso) => new Date(iso) > from);
  const description = eventDescription(input.medicines, input.notes) || null;
  const BATCH = 100;

  const created: { id: string; date: string }[] = [];
  for (let i = 0; i < starts.length; i += BATCH) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(
        starts.slice(i, i + BATCH).map((date) => ({
          series_id: seriesId,
          journey_id: null,
          user_id: primaryUserId,
          participants: participantIds,
          title: input.title,
          description,
          date,
          location: input.location || null,
          type: input.type,
          status: 'Scheduled',
        })),
      )
      .select('id, date');
    if (error) throw error;
    created.push(...(data || []));
  }

  const reminders = created.flatMap((a) =>
    buildReminderRows(a.id, a.date, [primaryUserId, ...participantIds], input.reminderLeads),
  );
  for (let i = 0; i < reminders.length; i += BATCH * 5) {
    const { error } = await supabase.from(REMINDERS_TABLE).insert(reminders.slice(i, i + BATCH * 5));
    if (error) throw error;
  }

  return { occurrences: created.length, remindersScheduled: reminders.length };
}

export const appointmentService = {
  // Fetch all appointments
  getAllAppointments: async (): Promise<Appointment[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(a => ({
          id: a.id,
          title: a.title,
          type: a.type,
          date: a.date ? a.date.split('T')[0] : '',
          time: a.date ? new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          location: a.location,
          status: fromDbStatus(a.status),
          notes: a.description,
          caseId: a.journey_id,
          userId: a.user_id,
          participants: mergeParticipantIds(a),
          startsAt: a.date,
          seriesId: a.series_id ?? null
      })) as Appointment[];
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }
  },

  // Create a new appointment
  createAppointment: async (appointment: any): Promise<string> => {
    try {
      const timestamp = appointment.time ? `${appointment.date}T${appointment.time}` : appointment.date;
      
      const participantIds = Array.isArray(appointment.participants)
        ? [...new Set(appointment.participants.filter(Boolean))]
        : [];
      const primaryUserId = appointment.userId || participantIds[0] || null;

      // Per client review: appointments only saved the first participant.
      // Persist the full participants array (the column exists on the DB row
      // — see mergeParticipantIds above).
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          journey_id: appointment.caseId || null,
          user_id: primaryUserId,
          participants: participantIds,
          title: appointment.title,
          description: appointment.notes,
          date: new Date(timestamp).toISOString(),
          location: appointment.location,
          type: appointment.type,
          status: toDbStatus(appointment.status)
        })
        .select('id')
        .single();
      
      if (error) throw error;

      // Push: notify the participants of the new appointment / reminder.
      const isReminder = isReminderEventType(appointment.type);
      const heading = isReminder ? 'New reminder scheduled' : 'New appointment';
      const fallbackTitle = isReminder ? 'Reminder' : 'Appointment';
      void pushService.send(
        [primaryUserId, ...participantIds],
        heading,
        `${appointment.title || fallbackTitle} on ${new Date(timestamp).toLocaleString()}`,
        { type: 'appointment', appointmentId: data.id },
      );
      void emailService.send(
        [primaryUserId, ...participantIds],
        heading,
        `${appointment.title || fallbackTitle} on ${new Date(timestamp).toLocaleString()}`,
        { type: 'appointment', appointmentId: data.id },
      );

      return data.id;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  },

  // Update an appointment
  updateAppointment: async (id: string, updates: any): Promise<void> => {
    try {
      const mappedUpdates: any = {};
      if (updates.title) mappedUpdates.title = updates.title;
      if (updates.notes) mappedUpdates.description = updates.notes;
      if (updates.location) mappedUpdates.location = updates.location;
      if (updates.status) mappedUpdates.status = toDbStatus(updates.status);
      if (updates.type) mappedUpdates.type = updates.type;
      if (updates.userId !== undefined) {
        mappedUpdates.user_id = updates.userId || null;
      }

      // Per client review: edits weren't saving extra participants. Persist
      // the full array — and keep user_id in sync with primary participant.
      if (updates.participants !== undefined) {
        const participantIds = Array.isArray(updates.participants)
          ? [...new Set(updates.participants.filter(Boolean))]
          : [];
        mappedUpdates.participants = participantIds;
        if (updates.userId === undefined && participantIds.length > 0) {
          mappedUpdates.user_id = participantIds[0];
        }
      }

      if (updates.date || updates.time) {
          const d = updates.date || new Date().toISOString().split('T')[0];
          const t = updates.time || '00:00:00';
          mappedUpdates.date = new Date(`${d}T${t}`).toISOString();
      }

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(mappedUpdates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  },

  // Delete an appointment
  deleteAppointment: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  },

  // ─── Push reminders ────────────────────────────────────────────────────────

  /** Lead times (minutes before the event) that have a reminder scheduled. */
  getReminderLeads: async (appointmentId: string): Promise<number[]> => {
    const { data, error } = await supabase
      .from(REMINDERS_TABLE)
      .select('lead_minutes')
      .eq('appointment_id', appointmentId);

    if (error) throw error;
    const leads = [...new Set((data || []).map((r: any) => Number(r.lead_minutes)))];
    return leads.sort((a, b) => b - a);
  },

  /**
   * Replace an event's push reminders. One reminder is scheduled per attendee
   * for each lead time in [leadMinutes]; the database sends them when they come
   * due (see the appointment_reminders migration). Call this after creating or
   * editing the event so the reminders follow its current date and attendees.
   *
   * Returns how many reminders are now scheduled and how many of the requested
   * lead times were skipped because that moment has already passed.
   */
  setReminders: async (
    appointmentId: string,
    leadMinutes: number[],
  ): Promise<{ scheduled: number; skippedPast: number }> => {
    const { data: appt, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('id, date, user_id, participants')
      .eq('id', appointmentId)
      .single();
    if (fetchError) throw fetchError;

    const userIds = mergeParticipantIds(appt);
    const rows = buildReminderRows(appointmentId, appt.date, userIds, leadMinutes);

    // Start from a clean slate so reminders always match the event as it is
    // now (a moved event gets fresh reminders, a removed lead time goes away).
    const { error: deleteError } = await supabase
      .from(REMINDERS_TABLE)
      .delete()
      .eq('appointment_id', appointmentId);
    if (deleteError) throw deleteError;

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from(REMINDERS_TABLE).insert(rows);
      if (insertError) throw insertError;
    }

    const requested = new Set(leadMinutes).size * userIds.length;
    return { scheduled: rows.length, skippedPast: Math.max(0, requested - rows.length) };
  },

  // ─── Repeating schedules ───────────────────────────────────────────────────

  /**
   * Create a repeating schedule: the series row, one event per occurrence and
   * the push reminders for each. The user gets one "new schedule" push rather
   * than one per occurrence.
   */
  createSeries: async (
    input: SeriesInput,
  ): Promise<{ seriesId: string; occurrences: number; remindersScheduled: number }> => {
    const participantIds = [...new Set(input.participants.filter(Boolean))];
    const primaryUserId = input.userId || participantIds[0] || null;

    const { data: series, error: seriesError } = await supabase
      .from(SERIES_TABLE)
      .insert(seriesRow(input, primaryUserId, participantIds))
      .select('id')
      .single();
    if (seriesError) throw seriesError;

    try {
      const created = await insertOccurrences(series.id, input, primaryUserId, participantIds, new Date(0));
      const first = expandRecurrence(input.recurrence)[0];
      const heading = isReminderEventType(input.type) ? 'New reminder schedule' : 'New recurring appointment';
      const message = `${input.title}: ${describeRecurrence(input.recurrence)}`;
      void pushService.send([primaryUserId, ...participantIds], heading, message, {
        type: 'appointment',
        seriesId: series.id,
        ...(first ? { startsAt: first } : {}),
      });
      void emailService.send([primaryUserId, ...participantIds], heading, message, {
        type: 'appointment',
        seriesId: series.id,
      });
      return { seriesId: series.id, ...created };
    } catch (error) {
      // Don't leave a series with only some of its events behind.
      await supabase.from(SERIES_TABLE).delete().eq('id', series.id);
      throw error;
    }
  },

  /** The schedule as saved, for editing. */
  getSeries: async (seriesId: string): Promise<SeriesInput & { id: string }> => {
    const { data, error } = await supabase.from(SERIES_TABLE).select('*').eq('id', seriesId).single();
    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      type: data.type,
      location: data.location ?? '',
      notes: data.description ?? '',
      userId: data.user_id ?? '',
      participants: data.participants ?? [],
      medicines: Array.isArray(data.medications) ? data.medications : [],
      recurrence: data.recurrence,
      reminderLeads: data.reminder_leads ?? [],
    };
  },

  /**
   * Change a schedule. Occurrences that have already happened are kept as
   * they were; every upcoming one is replaced by the new schedule.
   */
  updateSeries: async (
    seriesId: string,
    input: SeriesInput,
  ): Promise<{ occurrences: number; remindersScheduled: number }> => {
    const participantIds = [...new Set(input.participants.filter(Boolean))];
    const primaryUserId = input.userId || participantIds[0] || null;
    const now = new Date();

    const { error: updateError } = await supabase
      .from(SERIES_TABLE)
      .update({ ...seriesRow(input, primaryUserId, participantIds), updated_at: now.toISOString() })
      .eq('id', seriesId);
    if (updateError) throw updateError;

    // Their reminders go with them (ON DELETE CASCADE).
    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('series_id', seriesId)
      .gte('date', now.toISOString());
    if (deleteError) throw deleteError;

    return insertOccurrences(seriesId, input, primaryUserId, participantIds, now);
  },

  /**
   * Stop a schedule: delete its upcoming occurrences (past ones stay on the
   * calendar as a record). The series itself goes once nothing is left.
   */
  deleteUpcomingInSeries: async (seriesId: string): Promise<number> => {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('series_id', seriesId)
      .gte('date', new Date().toISOString())
      .select('id');
    if (error) throw error;

    const { count } = await supabase
      .from(TABLE_NAME)
      .select('id', { count: 'exact', head: true })
      .eq('series_id', seriesId);
    if (count === 0) await supabase.from(SERIES_TABLE).delete().eq('id', seriesId);

    return data?.length ?? 0;
  },

  // Get appointments by type
  getAppointmentsByType: async (type: string): Promise<Appointment[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('type', type)
        .order('date', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(a => ({
          id: a.id,
          title: a.title,
          type: a.type,
          date: a.date ? a.date.split('T')[0] : '',
          location: a.location,
          status: fromDbStatus(a.status),
          caseId: a.journey_id,
          userId: a.user_id,
          participants: mergeParticipantIds(a)
      })) as Appointment[];
    } catch (error) {
      console.error('Error fetching appointments by type:', error);
      throw error;
    }
  }
};

