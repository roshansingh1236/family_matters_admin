-- Repeating calendar reminders (e.g. "take these medicines every day for
-- 3 weeks").
--
-- The admin calendar expands a repeating schedule into one `appointments` row
-- per occurrence, so each dose shows on the user's in-app calendar and gets
-- its own push reminders through appointment_reminders (see
-- 20261002_appointment_reminders.sql) with no app changes. This migration adds
-- the record that ties those occurrences together:
--
--   appointment_series       the schedule as the admin entered it (repeat
--                            rule, times, medicines, push reminder lead times)
--                            so the whole series can be edited or stopped
--   appointments.series_id   the series an occurrence belongs to (NULL for a
--                            one-off event)
--
-- Deleting a series deletes its occurrences (and their reminders, which
-- already cascade from appointments).
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.appointment_series (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  type            text,
  description     text,
  location        text,
  user_id         uuid REFERENCES public.users(id) ON DELETE CASCADE,
  participants    uuid[] NOT NULL DEFAULT '{}',
  -- [{ "name": "Estrace", "dose": "2 mg" }, ...] for medication / injection
  medications     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- {
  --   "frequency": "daily" | "interval" | "weekly",
  --   "interval":  2,                 -- every N days (frequency = interval)
  --   "weekdays":  [1, 3, 5],         -- 0 = Sunday (frequency = weekly)
  --   "startDate": "2026-11-01",      -- in the admin's time zone
  --   "endDate":   "2026-11-21",      -- inclusive; or
  --   "count":     21,                -- number of days with a dose
  --   "times":     ["08:00", "20:00"],
  --   "timeZone":  "America/Chicago"  -- the admin's zone when generated
  -- }
  recurrence      jsonb NOT NULL,
  reminder_leads  integer[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS series_id uuid
    REFERENCES public.appointment_series(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_appointments_series
  ON public.appointments (series_id)
  WHERE series_id IS NOT NULL;

ALTER TABLE public.appointment_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_series_admin_all" ON public.appointment_series;
CREATE POLICY "appointment_series_admin_all" ON public.appointment_series
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "appointment_series_view_own" ON public.appointment_series;
CREATE POLICY "appointment_series_view_own" ON public.appointment_series
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = ANY (participants));

REVOKE ALL ON public.appointment_series FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_series TO authenticated;
GRANT ALL ON public.appointment_series TO service_role;
