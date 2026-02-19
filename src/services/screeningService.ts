
import { supabase } from '../lib/supabase';
import type { MedicalScreening, MedicalScreeningStatus, CaseDocument } from '../types';

const TABLE_NAME = 'medical_screening';

export const screeningService = {
  // Get all screenings (for list view)
  getAllScreenings: async (): Promise<MedicalScreening[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as MedicalScreening[];
    } catch (error) {
      console.error('Error fetching screenings:', error);
      throw error;
    }
  },

  // Get screening by ID
  getScreeningById: async (id: string): Promise<MedicalScreening | null> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as MedicalScreening;
    } catch (error) {
      console.error('Error fetching screening details:', error);
      throw error;
    }
  },

  // Get screening for a specific surrogate
  getScreeningBySurrogateId: async (surrogateId: string): Promise<MedicalScreening | null> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('surrogate_id', surrogateId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as MedicalScreening;
    } catch (error) {
       console.error('Error fetching surrogate screening:', error);
       throw error;
    }
  },

  // Create or Update Screening Record
  saveScreening: async (screening: any): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          surrogate_id: screening.surrogateId,
          status: screening.status || 'Pending',
          medical_history: screening.medicalHistory,
          internal_notes: screening.internalNotes,
          submitted_at: screening.submittedAt || new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error saving screening:', error);
      throw error;
    }
  },

  // Update Status (Clearance Decision)
  updateStatus: async (id: string, status: MedicalScreeningStatus, notes?: string, adminId?: string): Promise<void> => {
    try {
      const updates: any = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      };
      
      if (notes) {
        updates.internal_notes = notes;
      }
      
      if (status === 'Cleared') {
        updates.clearance_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      // OPTIONAL: Sync simplified status to User Profile
      if (status === 'Cleared' || status === 'Rejected') {
           const { data: screening } = await supabase
            .from(TABLE_NAME)
            .select('surrogate_id')
            .eq('id', id)
            .single();

           if (screening && screening.surrogate_id) {
               await supabase
                .from('users')
                .update({ medical_clearance_status: status })
                .eq('id', screening.surrogate_id);
           }
      }

    } catch (error) {
      console.error('Error updating screening status:', error);
      throw error;
    }
  },

  // Add Document to Screening
  addDocument: async (id: string, document: CaseDocument): Promise<void> => {
    try {
       const { error } = await supabase
        .from('documents')
        .insert({
            screening_id: id,
            name: document.name,
            url: document.url,
            type: document.type,
            status: document.status || 'pending',
            uploaded_at: new Date().toISOString()
        });
        
       if (error) throw error;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }
};

