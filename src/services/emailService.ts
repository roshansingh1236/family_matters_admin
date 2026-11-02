import { supabase } from '../lib/supabase';

/**
 * Sends a transactional email via the `send-email` Edge Function (Resend).
 * Targets users by their Supabase user id; the edge function resolves emails.
 * Failures are swallowed so an email issue never blocks the underlying action.
 */
export const emailService = {
  send: async (
    userIds: (string | null | undefined)[],
    subject: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> => {
    const ids = Array.from(
      new Set((userIds || []).filter((x): x is string => !!x)),
    );
    if (ids.length === 0) return;
    try {
      await supabase.functions.invoke('send-email', {
        body: { userIds: ids, subject, message, data: data ?? {} },
      });
    } catch (e) {
      console.error('emailService.send failed', e);
    }
  },
};
