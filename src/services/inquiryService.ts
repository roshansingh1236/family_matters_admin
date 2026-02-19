
import { supabase } from '../lib/supabase';
import type { User } from '../types';

const TABLE_NAME = 'users';

export const inquiryService = {
  // Fetch all new inquiries
  getNewInquiries: async (): Promise<User[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('role', 'Intended Parent')
        .eq('status', 'New Inquiry')
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;

      const mappedData: User[] = (data || []).map(u => ({
        ...u,
        firstName: u.full_name?.split(' ')[0] || '',
        lastName: u.full_name?.split(' ').slice(1).join(' ') || '',
        createdAt: u.created_at,
        updatedAt: u.updated_at
      }));
      return mappedData;
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      throw error;
    }
  },

  // Update Inquiry Status (e.g., to 'Consultation Scheduled' or 'Intake in Progress')
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

