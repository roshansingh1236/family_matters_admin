import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { approvalSyncFields } from '../utils/approvalStatus';

const TABLE_NAME = 'users';

export const inquiryService = {
  // Fetch all new inquiries (Intended Parents in the initial lifecycle).
  // Per client review: declined/inactive inquiries are excluded — they live
  // in the archive view (see getArchivedInquiries).
  getNewInquiries: async (): Promise<User[]> => {
    try {
      // Include all early-stage statuses for Intended Parents.
      // This ensures that inquiries from the mobile app (which now default to 'Inquiry')
      // are pulled into the admin portal automatically.
      const { data, error: fetchError } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('role', 'Intended Parent')
        .in('status', [
          'Inquiry',
          'Consultation Pending',
          'Consultation Scheduled',
          'Consultation Complete',
          'new',
          'pending',
          'New Inquiry',
          'Reviewed',
          'Contacted',
          'Follow-Up'
        ])
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mappedData: User[] = (data || []).map(u => ({
        ...u,
        firstName: u.full_name?.split(' ')[0] || u.first_name || '',
        lastName: u.full_name?.split(' ').slice(1).join(' ') || u.last_name || '',
        createdAt: u.created_at,
        updatedAt: u.updated_at
      }));
      return mappedData;
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      throw error;
    }
  },

  // Fetch archived (Declined / Inactive) inquiries so admins can retrieve
  // them later. The Inquiries page exposes this through an Archived tab.
  getArchivedInquiries: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('role', 'Intended Parent')
        .eq('status', 'Declined / Inactive')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(u => ({
        ...u,
        firstName: u.full_name?.split(' ')[0] || u.first_name || '',
        lastName: u.full_name?.split(' ').slice(1).join(' ') || u.last_name || '',
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));
    } catch (error) {
      console.error('Error fetching archived inquiries:', error);
      throw error;
    }
  },

  // Restore an archived inquiry by setting it back to the default Inquiry state.
  restoreInquiry: async (userId: string): Promise<void> => {
    await inquiryService.updateInquiryStatus(userId, 'Inquiry');
  },

  // Update Inquiry Status
  updateInquiryStatus: async (userId: string, status: string, notes?: string): Promise<void> => {
    try {
      const updates: any = {
        status,
        ...approvalSyncFields(status),
        updated_at: new Date().toISOString(),
      };

      if (notes) {
        updates['admin_notes'] = notes;
      }

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updates)
        .eq('id', userId);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating inquiry status:', error);
      throw error;
    }
  },
  
  // Archive or Decline Inquiry
  archiveInquiry: async (userId: string): Promise<void> => {
      await inquiryService.updateInquiryStatus(userId, 'Declined / Inactive');
  },

  // Fetch Surrogate Inquiries (from the dedicated table)
  getSurrogateInquiries: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('surrogate_inquiries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching surrogate inquiries:', error);
      throw error;
    }
  },

  updateSurrogateInquiryStatus: async (id: string, status: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('surrogate_inquiries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating surrogate inquiry status:', error);
      throw error;
    }
  },

  // Convert a Surrogate Inquiry lead into a full User Profile
  convertSurrogateToProfile: async (inquiry: any): Promise<void> => {
    try {
      // 1. Create the user row (Staff will need to manually trigger auth invite or we do it here)
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: inquiry.email,
          first_name: inquiry.first_name,
          last_name: inquiry.last_name,
          role: 'Surrogate',
          status: 'Inquiry',
          phone: inquiry.phone,
          form_data: {
            initial_inquiry_id: inquiry.id,
            state: inquiry.state,
            previous_pregnancy: inquiry.previous_pregnancy,
            message: inquiry.message
          }
        })
        .select()
        .single();

      if (userError) throw userError;

      // 2. Update the inquiry status
      await inquiryService.updateSurrogateInquiryStatus(inquiry.id, 'converted');
    } catch (error) {
      console.error('Error converting surrogate inquiry:', error);
      throw error;
    }
  }
};
