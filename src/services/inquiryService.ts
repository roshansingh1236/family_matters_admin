import { supabase } from '../lib/supabase';
import type { User } from '../types';

const TABLE_NAME = 'users';

export const inquiryService = {
  // Fetch all new inquiries (Intended Parents in the initial lifecycle)
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

  // Update Inquiry Status
  updateInquiryStatus: async (userId: string, status: string, notes?: string): Promise<void> => {
    try {
      const updates: any = {
        status,
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
  }
};
