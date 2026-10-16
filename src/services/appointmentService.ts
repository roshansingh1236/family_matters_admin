
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
}

const TABLE_NAME = 'appointments';
const REMINDERS_TABLE = 'appointment_reminders';

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
          startsAt: a.date
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

