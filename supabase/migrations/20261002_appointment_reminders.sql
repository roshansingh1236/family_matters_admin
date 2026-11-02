-- Calendar rework: push reminders the agency schedules for a user.
--
-- The admin calendar creates an event for a surrogate / intended parent (for
-- example a medication or injection she has to take on a given day). The event
-- already shows on her in-app calendar because it is an `appointments` row.
-- This migration adds the "notify her when the date approaches" part:
--
--   appointment_reminders          one row per (event, user, lead time)
--   dispatch_due_appointment_reminders()
--                                  sends every reminder that has come due:
--                                  an in-app notification + a push through the
--                                  existing `send-push` Edge Function
--   pg_cron job                    runs the dispatcher every 5 minutes
--
-- One-time setup after running this file (SQL editor) — the dispatcher needs to
-- know where the Edge Function lives. Until both secrets exist it still creates
-- the in-app notifications, it just can't send the push:
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<the project anon key>', 'anon_key');

-- ─── Reminders table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- When the push goes out, and how long before the event that is (0 = at the
  -- scheduled time). The wording of the push is derived from lead_minutes so
  -- it never depends on a time zone.
  remind_at       timestamptz NOT NULL,
  lead_minutes    integer NOT NULL DEFAULT 0 CHECK (lead_minutes >= 0),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, user_id, lead_minutes)
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_due
  ON public.appointment_reminders (remind_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment
  ON public.appointment_reminders (appointment_id);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_reminders_admin_all" ON public.appointment_reminders;
CREATE POLICY "appointment_reminders_admin_all" ON public.appointment_reminders
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "appointment_reminders_view_own" ON public.appointment_reminders;
CREATE POLICY "appointment_reminders_view_own" ON public.appointment_reminders
  FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON public.appointment_reminders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;

-- ─── Dispatcher ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dispatch_due_appointment_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  v_url      text;
  v_key      text;
  v_kind     text;
  v_heading  text;
  v_message  text;
  v_details  text;
  v_sent     integer := 0;
BEGIN
  -- Where to reach the send-push Edge Function. Missing secrets (or no Vault)
  -- only disables the push; the in-app notification is still created.
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
    v_key := NULL;
  END;

  FOR r IN
    -- Claim every due reminder in one statement so two overlapping runs can
    -- never send the same reminder twice.
    UPDATE public.appointment_reminders ar
       SET sent_at = now()
      FROM public.appointments a
     WHERE a.id = ar.appointment_id
       AND ar.sent_at IS NULL
       AND ar.remind_at <= now()
       AND COALESCE(a.status, 'Scheduled') = 'Scheduled'
    RETURNING ar.user_id, ar.lead_minutes, ar.remind_at,
              a.id AS appointment_id, a.title, a.type, a.description
  LOOP
    -- A reminder that is many hours overdue (scheduler was paused, or the
    -- event was created after its reminder time) is closed without notifying:
    -- a late "it's time" would only confuse.
    CONTINUE WHEN r.remind_at < now() - interval '6 hours';

    v_kind := lower(COALESCE(r.type, ''));
    v_heading := CASE
      WHEN v_kind = 'medication' THEN 'Medication reminder'
      WHEN v_kind = 'injection'  THEN 'Injection reminder'
      WHEN v_kind = 'reminder'   THEN 'Reminder'
      ELSE 'Appointment reminder'
    END;

    v_message := COALESCE(NULLIF(btrim(r.title), ''), 'Your scheduled event') ||
      CASE
        WHEN r.lead_minutes = 0     THEN ' — it''s time.'
        WHEN r.lead_minutes = 60    THEN ' is in 1 hour.'
        WHEN r.lead_minutes = 1440  THEN ' is tomorrow.'
        WHEN r.lead_minutes < 60    THEN ' is in ' || r.lead_minutes || ' minutes.'
        WHEN r.lead_minutes % 1440 = 0 THEN ' is in ' || (r.lead_minutes / 1440) || ' days.'
        WHEN r.lead_minutes % 60 = 0   THEN ' is in ' || (r.lead_minutes / 60) || ' hours.'
        ELSE ' is coming up.'
      END;

    -- Add the admin's notes (e.g. the dose) so the push is actionable.
    v_details := NULLIF(btrim(COALESCE(r.description, '')), '');
    IF v_details IS NOT NULL THEN
      v_message := v_message || ' ' ||
        CASE WHEN length(v_details) > 140 THEN left(v_details, 137) || '...' ELSE v_details END;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (r.user_id, v_heading, v_message, 'appointment_reminder');

    IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url     := rtrim(v_url, '/') || '/functions/v1/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', v_key,
            'Authorization', 'Bearer ' || v_key
          ),
          body    := jsonb_build_object(
            'externalUserIds', jsonb_build_array(r.user_id),
            'title', v_heading,
            'message', v_message,
            'data', jsonb_build_object(
              'type', 'appointment_reminder',
              'appointmentId', r.appointment_id
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'dispatch_due_appointment_reminders: push failed for %: %',
          r.appointment_id, SQLERRM;
      END;
    END IF;

    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$;

-- Only the scheduler (and admins via the SQL editor) may run the dispatcher.
REVOKE ALL ON FUNCTION public.dispatch_due_appointment_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_due_appointment_reminders() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_appointment_reminders() TO service_role;

-- ─── Schedule: every 5 minutes ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-appointment-reminders') THEN
    PERFORM cron.unschedule('dispatch-appointment-reminders');
  END IF;

  PERFORM cron.schedule(
    'dispatch-appointment-reminders',
    '*/5 * * * *',
    'SELECT public.dispatch_due_appointment_reminders();'
  );
END;
$$;
