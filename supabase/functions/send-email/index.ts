// Supabase Edge Function: send-email
// Sends transactional email via Gmail SMTP to one or more users, targeted by
// their Supabase user id (email address is resolved server-side from
// public.users so callers never need to pass/expose emails).
//
// Secrets (set with: supabase secrets set ...):
//   GMAIL_USER          = familymattersdev@gmail.com
//   GMAIL_APP_PASSWORD  = 16-char Gmail App Password (requires 2-Step Verification)
//
// Request body (POST, JSON):
//   { "userIds": ["<uuid>", ...], "subject": "...", "message": "...", "data": { ... } }
//
// If Gmail isn't configured yet, the function no-ops (returns skipped:true)
// so callers never error during rollout.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

  // Not configured yet → no-op so the rest of the app keeps working.
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return json({ skipped: true, reason: "Gmail SMTP not configured" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const userIds: string[] = Array.isArray(body.userIds)
    ? body.userIds.filter((x: unknown) => typeof x === "string" && x)
    : [];
  if (userIds.length === 0) return json({ skipped: true, reason: "no recipients" });

  const subject = (body.subject ?? "Family Matters").toString();
  const message = (body.message ?? "").toString();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: users, error } = await supabase
    .from("users")
    .select("email")
    .in("id", Array.from(new Set(userIds)));

  if (error) return json({ error: error.message }, 500);

  const emails = Array.from(
    new Set((users || []).map((u: { email: string | null }) => u.email).filter(Boolean)),
  ) as string[];
  if (emails.length === 0) return json({ skipped: true, reason: "no email addresses" });

  const html = `<p>${message.replace(/\n/g, "<br/>")}</p>`;

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });

  try {
    const results = await Promise.all(
      emails.map((to) =>
        client
          .send({
            from: `Family Matters <${GMAIL_USER}>`,
            to,
            subject,
            html,
          })
          .then(() => ({ ok: true, to }))
          .catch((e) => ({ ok: false, to, error: String(e) })),
      ),
    );
    await client.close();
    const ok = results.every((r) => r.ok);
    return json({ ok, results }, ok ? 200 : 502);
  } catch (e) {
    await client.close();
    return json({ error: String(e) }, 502);
  }
});
