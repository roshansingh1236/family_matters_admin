import { supabase } from '../lib/supabase';

export interface MedicalRecord {
  id?: string;
  surrogateId?: string;
  patientName: string;
  userId?: string;
  date: string;
  type: string;
  title: string;
  summary: string;
  provider: string;
  doctor?: string;
  facility?: string;
  status: 'Verified' | 'Pending' | 'Flagged';
  sharedWithParents: boolean;
  attachments?: string[];
  createdAt?: string;
}

export interface Medication {
  id?: string;
  surrogateId?: string;
  userId?: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Discontinued';
  notes?: string;
}

const RECORDS_TABLE = 'medical_records';
const MEDS_TABLE = 'medications';

export const medicalService = {
  // --- Medical Records ---

  getAllRecords: async (): Promise<MedicalRecord[]> => {
    try {
      const { data, error } = await supabase
        .from(RECORDS_TABLE)
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        surrogateId: r.surrogate_id,
        userId: r.user_id,
        patientName: r.patient_name,
        sharedWithParents: r.shared_with_parents,
        createdAt: r.created_at
      })) as MedicalRecord[];
    } catch (error) {
      console.error('Error fetching medical records:', error);
      throw error;
    }
  },

  createRecord: async (record: any): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(RECORDS_TABLE)
        .insert({
          surrogate_id: record.surrogateId,
          user_id: record.userId,
          patient_name: record.patientName,
          date: record.date,
          type: record.type,
          title: record.title,
          summary: record.summary,
          provider: record.provider,
          doctor: record.doctor,
          facility: record.facility,
          status: record.status || 'Pending',
          shared_with_parents: record.sharedWithParents,
          attachments: record.attachments || []
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating medical record:', error);
      throw error;
    }
  },

  updateRecord: async (id: string, updates: Partial<MedicalRecord>): Promise<void> => {
    try {
      // Map to snake_case if necessary, depend on your schema strategy
      const { error } = await supabase
        .from(RECORDS_TABLE)
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating medical record:', error);
      throw error;
    }
  },

  deleteRecord: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(RECORDS_TABLE)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting medical record:', error);
      throw error;
    }
  },

  // --- Medications ---

  getAllMedications: async (): Promise<Medication[]> => {
    try {
      const { data, error } = await supabase
        .from(MEDS_TABLE)
        .select('*')
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(m => ({
        ...m,
        surrogateId: m.surrogate_id,
        userId: m.user_id,
        startDate: m.start_date,
        endDate: m.end_date
      })) as Medication[];
    } catch (error) {
      console.error('Error fetching medications:', error);
      throw error;
    }
  },

  addMedication: async (medication: any): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(MEDS_TABLE)
        .insert({
          surrogate_id: medication.surrogateId,
          user_id: medication.userId,
          name: medication.name,
          dosage: medication.dosage,
          frequency: medication.frequency,
          start_date: medication.startDate,
          end_date: medication.endDate,
          status: medication.status || 'Active',
          notes: medication.notes
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating medication:', error);
      throw error;
    }
  },

  updateMedication: async (id: string, updates: Partial<Medication>): Promise<void> => {
    try {
      const { error } = await supabase
        .from(MEDS_TABLE)
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    }
  },

  deleteMedication: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(MEDS_TABLE)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    }
  },

  // --- Surrogate Specific ---

  getRecordsBySurrogateId: async (surrogateId: string): Promise<MedicalRecord[]> => {
    try {
      const { data, error } = await supabase
        .from(RECORDS_TABLE)
        .select('*')
        .or(`user_id.eq.${surrogateId},surrogate_id.eq.${surrogateId}`)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        surrogateId: r.surrogate_id,
        userId: r.user_id,
        patientName: r.patient_name,
        sharedWithParents: r.shared_with_parents,
        createdAt: r.created_at
      })) as MedicalRecord[];
    } catch (error) {
       console.error('Error fetching surrogate records:', error);
       return [];
    }
  },

  getMedicationsBySurrogateId: async (surrogateId: string): Promise<Medication[]> => {
    try {
      const { data, error } = await supabase
        .from(MEDS_TABLE)
        .select('*')
        .or(`user_id.eq.${surrogateId},surrogate_id.eq.${surrogateId}`)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(m => ({
        ...m,
        surrogateId: m.surrogate_id,
        userId: m.user_id,
        startDate: m.start_date,
        endDate: m.end_date
      })) as Medication[];
    } catch (error) {
      console.error('Error fetching surrogate medications:', error);
      return [];
    }
  }
};

