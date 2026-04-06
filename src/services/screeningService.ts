
import { supabase } from '../lib/supabase';
import type { MedicalScreening, MedicalScreeningStatus, CaseDocument, MedicalRecordRequest, MedicalRecordRequestStatus, ReceivedFile, HipaaAuthStatus } from '../types';

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
  },

  // ── Medical Record Requests (GC Pre-Screen) ─────────────────────────────────
  // Per spec: record requests are stored per GC in the users table under
  // the `record_requests` JSONB column (no separate table needed).

  getRecordRequests: async (gcId: string): Promise<MedicalRecordRequest[]> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('record_requests')
        .eq('id', gcId)
        .maybeSingle();
      if (error) throw error;
      return (data?.record_requests as MedicalRecordRequest[]) || [];
    } catch (error) {
      console.error('Error fetching record requests:', error);
      return [];
    }
  },

  saveRecordRequest: async (gcId: string, request: Omit<MedicalRecordRequest, 'id' | 'gcId' | 'createdAt'>): Promise<MedicalRecordRequest[]> => {
    try {
      const existing = await screeningService.getRecordRequests(gcId);
      const newRequest: MedicalRecordRequest = {
        ...request,
        id: `req_${Date.now()}`,
        gcId,
        createdAt: new Date().toISOString(),
      };
      const updated = [...existing, newRequest];
      const { error } = await supabase.from('users').update({ record_requests: updated }).eq('id', gcId);
      if (error) throw error;
      return updated;
    } catch (error) {
      console.error('Error saving record request:', error);
      throw error;
    }
  },

  updateRecordRequest: async (gcId: string, requestId: string, updates: Partial<MedicalRecordRequest>): Promise<MedicalRecordRequest[]> => {
    try {
      const existing = await screeningService.getRecordRequests(gcId);
      const updated = existing.map(r =>
        r.id === requestId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      );
      const { error } = await supabase.from('users').update({ record_requests: updated }).eq('id', gcId);
      if (error) throw error;
      return updated;
    } catch (error) {
      console.error('Error updating record request:', error);
      throw error;
    }
  },

  deleteRecordRequest: async (gcId: string, requestId: string): Promise<MedicalRecordRequest[]> => {
    try {
      const existing = await screeningService.getRecordRequests(gcId);
      const updated = existing.filter(r => r.id !== requestId);
      const { error } = await supabase.from('users').update({ record_requests: updated }).eq('id', gcId);
      if (error) throw error;
      return updated;
    } catch (error) {
      console.error('Error deleting record request:', error);
      throw error;
    }
  },

  // Attach a received file to a specific record request
  addFileToRequest: async (gcId: string, requestId: string, file: Omit<ReceivedFile, 'id'>): Promise<MedicalRecordRequest[]> => {
    try {
      const existing = await screeningService.getRecordRequests(gcId);
      const updated = existing.map(r => {
        if (r.id !== requestId) return r;
        const newFile: ReceivedFile = { ...file, id: `file_${Date.now()}` };
        return { ...r, receivedFiles: [...(r.receivedFiles || []), newFile], updatedAt: new Date().toISOString() };
      });
      const { error } = await supabase.from('users').update({ record_requests: updated }).eq('id', gcId);
      if (error) throw error;
      return updated;
    } catch (error) {
      console.error('Error attaching file to request:', error);
      throw error;
    }
  },

  // Remove a received file from a record request
  removeFileFromRequest: async (gcId: string, requestId: string, fileId: string): Promise<MedicalRecordRequest[]> => {
    try {
      const existing = await screeningService.getRecordRequests(gcId);
      const updated = existing.map(r => {
        if (r.id !== requestId) return r;
        return { ...r, receivedFiles: (r.receivedFiles || []).filter(f => f.id !== fileId), updatedAt: new Date().toISOString() };
      });
      const { error } = await supabase.from('users').update({ record_requests: updated }).eq('id', gcId);
      if (error) throw error;
      return updated;
    } catch (error) {
      console.error('Error removing file from request:', error);
      throw error;
    }
  },

  // Update HIPAA authorization status for a request
  updateHipaaAuth: async (gcId: string, requestId: string, status: HipaaAuthStatus): Promise<MedicalRecordRequest[]> => {
    try {
      const existing = await screeningService.getRecordRequests(gcId);
      const now = new Date().toISOString();
      const updated = existing.map(r => {
        if (r.id !== requestId) return r;
        return {
          ...r,
          hipaaAuthStatus: status,
          hipaaAuthSentAt: status === 'Sent' ? now : r.hipaaAuthSentAt,
          hipaaAuthSignedAt: status === 'Signed' ? now : r.hipaaAuthSignedAt,
          updatedAt: now,
        };
      });
      const { error } = await supabase.from('users').update({ record_requests: updated }).eq('id', gcId);
      if (error) throw error;
      return updated;
    } catch (error) {
      console.error('Error updating HIPAA auth status:', error);
      throw error;
    }
  },

  // Clearance logic check: returns blocking issues before allowing "Medically Cleared for Program"
  checkClearanceEligibility: async (gcId: string): Promise<{ eligible: boolean; issues: string[] }> => {
    try {
      const requests = await screeningService.getRecordRequests(gcId);
      const issues: string[] = [];

      for (const req of requests) {
        const label = `${req.providerName} (Pregnancy #${req.pregnancyNumber ?? '?'})`;
        if (!req.authorizationOnFile) {
          issues.push(`${label}: Authorization not on file`);
        }
        if (req.status === 'Not Requested') {
          issues.push(`${label}: Records not yet requested`);
        }
        if (req.status === 'Requested' || req.status === 'Follow-Up Needed') {
          issues.push(`${label}: Records not yet received (status: ${req.status})`);
        }
        if ((req.status === 'Received (Complete)' || req.status === 'Received (Partial)') && !req.reviewSummary) {
          issues.push(`${label}: Records received but not yet reviewed — add a review summary`);
        }
        if (req.blockingIssues) {
          issues.push(`${label}: Flagged as having blocking issues`);
        }
      }

      return { eligible: issues.length === 0, issues };
    } catch (error) {
      console.error('Error checking clearance eligibility:', error);
      return { eligible: false, issues: ['Unable to verify clearance eligibility'] };
    }
  },
};

