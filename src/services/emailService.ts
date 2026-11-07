import { supabase } from '../lib/supabase';

/**
 * Sends a transactional email via the `send-email` Edge Function (Gmail SMTP / Resend).
 * Targets users by their Supabase user id or direct email.
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

  /**
   * Sends an account creation email containing auto-generated login credentials
   * and instructions that the user can change their password later.
   */
  sendCredentials: async ({
    userId,
    email,
    name,
    password,
    role,
  }: {
    userId?: string | null;
    email: string;
    name?: string;
    password: string;
    role: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return { success: false, error: 'Recipient email is required' };
    }

    const recipientName = name?.trim() || 'there';
    const roleTitle = role === 'Surrogate' || role === 'gestationalCarrier'
      ? 'Surrogate'
      : role === 'Intended Parent' || role === 'intendedParent'
      ? 'Intended Parent'
      : role;

    const subject = `Welcome to Family Matters Surrogacy - Your Account Credentials`;

    const textMessage =
`Dear ${recipientName},

Welcome to Family Matters Surrogacy! An account has been created for you as an ${roleTitle}.

Here are your temporary login credentials:
Email: ${cleanEmail}
Password: ${password}

Please sign in to the Family Matters portal or mobile app with these credentials. For your security, this is a temporary password. You can change your password at any time from your account settings after logging in, or via "Forgot Password" on the login screen.

If you have any questions, please reach out to our team.

Warm regards,
The Family Matters Surrogacy Team`;

    const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Family Matters Surrogacy</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #1f2937;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #e11d48, #be123c); padding: 32px 24px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Family Matters Surrogacy</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Welcome to our family</p>
    </div>
    <div style="padding: 32px 24px; line-height: 1.6; font-size: 15px;">
      <p style="margin-top: 0;">Dear <strong>${recipientName}</strong>,</p>
      <p>Welcome to <strong>Family Matters Surrogacy</strong>! An account has been created for you as an <strong>${roleTitle}</strong>.</p>
      
      <p>You can use the following credentials to log in to the Family Matters mobile app and web portal:</p>
      
      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
        <div style="margin-bottom: 12px;">
          <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9f1239; margin-bottom: 4px;">Login Email</span>
          <span style="font-size: 16px; font-weight: 600; color: #1f2937;">${cleanEmail}</span>
        </div>
        <div>
          <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9f1239; margin-bottom: 4px;">Temporary Password</span>
          <span style="display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 18px; font-weight: 700; color: #be123c; background: #ffe4e6; padding: 4px 10px; border-radius: 6px; letter-spacing: 1px;">${password}</span>
        </div>
      </div>

      <div style="background-color: #f3f4f6; border-left: 4px solid #f43f5e; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #374151; border-radius: 0 6px 6px 0;">
        <strong>🔒 Security Notice:</strong> This is an auto-generated temporary password. You can change your password at any time from your account settings after logging in, or by clicking <em>"Forgot Password"</em> on the sign-in screen.
      </div>

      <p style="margin-top: 24px;">If you have any questions or require assistance getting started, please don't hesitate to contact our team.</p>

      <p style="margin-top: 28px; margin-bottom: 0;">With our warmest regards,<br/><strong>The Family Matters Surrogacy Team</strong></p>
    </div>
    <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Family Matters Surrogacy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    try {
      const userIds = userId ? [userId] : [];
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          userIds,
          email: cleanEmail,
          emails: [cleanEmail],
          subject,
          message: textMessage,
          html: htmlMessage,
          data: {
            type: 'account_credentials',
            role,
          },
        },
      });

      if (error) {
        console.error('emailService.sendCredentials invocation error:', error);
        return { success: false, error: error.message };
      }

      if (data?.skipped) {
        console.warn('emailService.sendCredentials skipped:', data.reason);
        return { success: false, error: data.reason || 'SMTP service not configured' };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('emailService.sendCredentials error:', err);
      return { success: false, error: msg };
    }
  },
};

