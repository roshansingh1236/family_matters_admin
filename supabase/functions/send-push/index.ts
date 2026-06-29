// Supabase Edge Function: send-push
// Sends a OneSignal push notification to one or more users, targeted by their
// OneSignal "external user id" (which we set to the Supabase user id).
//
// Secrets (set with: supabase secrets set ...):
//   ONESIGNAL_APP_ID        = your OneSignal App ID
//   ONESIGNAL_REST_API_KEY  = your OneSignal REST API Key
//
// Request body (POST, JSON):
//   { "externalUserIds": ["<uuid>", ...], "title": "...", "message": "...", "data": { ... } }
//
// If OneSignal isn't configured yet, the function no-ops (returns skipped:true)
// so callers never error during rollout.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

  const APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
  const REST_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

  // Not configured yet → no-op so the rest of the app keeps working.
  if (!APP_ID || !REST_KEY) {
    return json({ skipped: true, reason: "OneSignal not configured" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const ids: string[] = Array.isArray(body.externalUserIds)
    ? body.externalUserIds.filter((x: unknown) => typeof x === "string" && x)
    : [];
  if (ids.length === 0) return json({ skipped: true, reason: "no recipients" });

  const payload = {
    app_id: APP_ID,
    include_external_user_ids: Array.from(new Set(ids)),
    channel_for_external_user_ids: "push",
    headings: { en: (body.title ?? "Family Matters").toString() },
    contents: { en: (body.message ?? "").toString() },
    data: body.data ?? {},
  };

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${REST_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    return json({ ok: res.ok, onesignal: out }, res.ok ? 200 : 502);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
