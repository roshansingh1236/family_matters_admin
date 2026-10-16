// Supabase Edge Function: password-reset
// Emails a one-time password-reset code to a user, so the mobile app and the
// admin dashboard can reset a password without depending on deep links or the
// Supabase-hosted auth mailer.
//
// Flow:
//   1. Client POSTs { "email": "user@example.com" } to this function.
//   2. We ask Supabase Auth (service role) for a recovery OTP for that email
//      and send the code through the same Gmail SMTP account `send-email` uses.
//   3. The client verifies the code with
//        supabase.auth.verifyOtp({ email, token, type: "recovery" })
//      and then sets the new password with supabase.auth.updateUser().
//
// Secrets (shared with send-email; set with: supabase secrets set ...):
//   GMAIL_USER          = the Gmail address emails are sent from
//   GMAIL_APP_PASSWORD  = 16-char Gmail App Password
//
// Response (always HTTP 200 unless the request itself is malformed):
//   { "sent": true }                          code emailed (or address unknown —
//                                             we answer the same either way so
//                                             this can't be used to probe which
//                                             emails have accounts)
//   { "sent": false, "reason": "..." }        Gmail isn't configured / delivery
//                                             failed → client falls back to
//                                             supabase.auth.resetPasswordForEmail

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Minimum gap between two codes for the same address.
const RESEND_COOLDOWN_MS = 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = (body?.email ?? "").toString().trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "A valid email is required" }, 400);
  }

  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return json({ sent: false, reason: "smtp_not_configured" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Throttle: if a recovery code went out for this account in the last minute,
  // don't issue another one (generating a new code invalidates the previous).
  try {
    const { data: row } = await admin
      .from("users")
      .select("id")
      // ilike = case-insensitive match; escape its wildcards so "_" in an
      // address is treated literally.
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
      .maybeSingle();
    if (row?.id) {
      const { data: authUser } = await admin.auth.admin.getUserById(row.id);
      const last = authUser?.user?.recovery_sent_at
        ? Date.parse(authUser.user.recovery_sent_at)
        : NaN;
      if (!Number.isNaN(last) && Date.now() - last < RESEND_COOLDOWN_MS) {
        return json({ sent: true, throttled: true });
      }
    }
  } catch (_) {
    // Throttling is best-effort; never block a reset because the lookup failed.
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const code = data?.properties?.email_otp;
  if (error || !code) {
    // Unknown address (or Auth refused). Answer exactly as on success so the
    // endpoint can't be used to find out which emails are registered.
    console.log("password-reset: no code issued:", error?.message ?? "no otp");
    return json({ sent: true });
  }

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.6">
      <p>Hello,</p>
      <p>We received a request to reset the password for your Family Matters Surrogacy account.</p>
      <p>Your password reset code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${escapeHtml(code)}</p>
      <p>Enter this code in the app together with your new password. The code can be used once and expires soon, so please use it right away.</p>
      <p>If you didn't ask to reset your password, you can ignore this email — your password will not change.</p>
      <p>Family Matters Surrogacy</p>
    </div>`;

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });

  try {
    await client.send({
      from: `Family Matters <${GMAIL_USER}>`,
      to: email,
      subject: "Your Family Matters password reset code",
      html,
    });
    await client.close();
    return json({ sent: true });
  } catch (e) {
    try {
      await client.close();
    } catch (_) { /* ignore */ }
    console.error("password-reset: email delivery failed:", String(e));
    return json({ sent: false, reason: "delivery_failed" });
  }
});
