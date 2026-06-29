import { supabase } from '../lib/supabase';

/**
 * Sends a push notification via the `send-push` Edge Function (OneSignal).
 * Targets users by their Supabase user id (= OneSignal external id).
 * Failures are swallowed so a push issue never blocks the underlying action.
 */
export const pushService = {
  send: async (
    externalUserIds: (string | null | undefined)[],
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> => {
    const ids = Array.from(
      new Set((externalUserIds || []).filter((x): x is string => !!x)),
    );
    if (ids.length === 0) return;
    try {
      await supabase.functions.invoke('send-push', {
        body: { externalUserIds: ids, title, message, data: data ?? {} },
      });
    } catch (e) {
      console.error('pushService.send failed', e);
    }
  },
};
