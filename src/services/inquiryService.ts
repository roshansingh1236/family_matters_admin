import { supabase, createAuthAccountForOther } from '../lib/supabase';
import type { User } from '../types';
import { approvalSyncFields } from '../utils/approvalStatus';
import { emailService } from './emailService';
import { generateRandomPassword } from '../utils/password';

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
  convertSurrogateToProfile: async (inquiry: any): Promise<{ tempPassword?: string; emailSent: boolean }> => {
    try {
      const email = (inquiry.email || '').trim();
      const fullName = [inquiry.first_name, inquiry.last_name].filter(Boolean).join(' ').trim();
      let newUserId: string | null = null;
      let tempPassword: string | undefined;
      let emailSent = false;

      if (email) {
        tempPassword = generateRandomPassword(10);
        newUserId = await createAuthAccountForOther(email, tempPassword, {
          full_name: fullName,
          role: 'Surrogate',
        });
      }

      const userData: Record<string, unknown> = {
        email: email || null,
        first_name: inquiry.first_name || null,
        last_name: inquiry.last_name || null,
        full_name: fullName,
        role: 'Surrogate',
        status: 'New Application',
        phone: inquiry.phone || null,
        profile_completed: false,
        form_data: {
          initial_inquiry_id: inquiry.id,
          state: inquiry.state,
          previous_pregnancy: inquiry.previous_pregnancy,
          message: inquiry.message,
        },
      };

      if (newUserId) {
        userData.id = newUserId;
        const { error: upsertErr } = await supabase
          .from('users')
          .upsert(userData, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;

        if (tempPassword) {
          const emailRes = await emailService.sendCredentials({
            userId: newUserId,
            email,
            name: fullName,
            password: tempPassword,
            role: 'Surrogate',
          });
          emailSent = emailRes.success;
        }
      } else {
        const { error: userError } = await supabase
          .from('users')
          .insert(userData);
        if (userError) throw userError;
      }

      // 2. Update the inquiry status
      await inquiryService.updateSurrogateInquiryStatus(inquiry.id, 'converted');

      return { tempPassword, emailSent };
    } catch (error) {
      console.error('Error converting surrogate inquiry:', error);
      throw error;
    }
  },
};
