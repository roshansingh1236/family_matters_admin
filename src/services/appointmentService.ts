
import { supabase } from '../lib/supabase';

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
}

const TABLE_NAME = 'appointments';

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
          participants: mergeParticipantIds(a)
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

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          journey_id: appointment.caseId || null,
          user_id: primaryUserId,
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

