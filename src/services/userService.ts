import { supabase } from '../lib/supabase';
import { pushService } from './pushService';
import { emailService } from './emailService';
import { approvalSyncFields } from '../utils/approvalStatus';
import type { UserStatus } from '../types';

export const isAcceptedStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s === 'accepted to program' || s === 'accepted into program';
};

export const userService = {
  /**
   * Updates a user's lifecycle status, keeping `agency_approved` in sync
   * and automatically dispatching celebratory push and email notifications
   * when advanced to "Accepted into Program" / "Accepted to Program".
   */
  updateUserStatus: async (
    userId: string,
    newStatus: UserStatus | string,
  ): Promise<void> => {
    const syncFields = approvalSyncFields(newStatus);
    const { error } = await supabase
      .from('users')
      .update({
        status: newStatus,
        ...syncFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;

    if (isAcceptedStatus(newStatus)) {
      await userService.notifyAcceptedToProgram(userId);
    }
  },

  /**
   * Sends celebratory push, email, and in-app notifications
   * to a user accepted into the Family Matters Surrogacy program.
   */
  notifyAcceptedToProgram: async (userId: string): Promise<void> => {
    try {
      // Resolve user details for personalized message
      const { data: user } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('id', userId)
        .single();

      const firstName = user?.first_name ? ` ${user.first_name}` : '';
      const isSurrogate =
        user?.role === 'Surrogate' || user?.role === 'gestationalCarrier';
      const roleTitle = isSurrogate ? 'Surrogate' : 'Intended Parent';

      const pushTitle = '🎉 Congratulations! You\'re Accepted!';
      const pushMessage = `Congratulations${firstName}! You have been accepted into the Family Matters Surrogacy Program! Welcome to the family! ✨💖`;

      const emailSubject = '🎉 Congratulations! You\'re Accepted to Family Matters Surrogacy!';
      const emailMessage =
        `Dear${firstName},\n\n` +
        `Congratulations! 🎊 We are thrilled to let you know that you have been officially accepted into the Family Matters Surrogacy Program!\n\n` +
        `You are officially part of our Family Matters family, and your profile is now ready for matching! We can't wait to partner with you on this wonderful journey.\n\n` +
        `Open the Family Matters app to celebrate and view your next milestones.\n\n` +
        `With our warmest congratulations,\n` +
        `The Family Matters Surrogacy Team ✨`;

      // 1. Push notification via OneSignal Edge Function
      void pushService.send(
        [userId],
        pushTitle,
        pushMessage,
        {
          type: 'accepted_to_program',
          celebration: true,
          role: roleTitle,
        },
      );

      // 2. Transactional email via Resend / Gmail Edge Function
      void emailService.send(
        [userId],
        emailSubject,
        emailMessage,
        {
          type: 'accepted_to_program',
          celebration: true,
          role: roleTitle,
        },
      );

      // 3. In-App Notification in notifications table
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: pushTitle,
          message: pushMessage,
          type: 'system_alert',
          is_read: false,
        });
      } catch (notifErr) {
        console.warn('Failed to insert in-app notification:', notifErr);
      }
    } catch (err) {
      console.error('userService.notifyAcceptedToProgram failed:', err);
    }
  },
};
