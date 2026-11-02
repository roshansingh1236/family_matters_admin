-- Surrogate "Release of Medical Records" form.
--
-- Replaces the in-app Medical Intake / Medical Screening form: the surrogate
-- fills in and signs this release before Form 2, and the agency then requests
-- her records from the provider directly.
--
-- This form holds PHI (date of birth, Social Security Number, signature), so it
-- lives in its own table rather than in users.form_data: the users row is
-- readable by a matched counterpart (policy "user_view_match_counterpart") and
-- the document buckets are public, neither of which is acceptable for an SSN.
-- Only the surrogate herself and agency admins/staff can read a row here.

CREATE TABLE IF NOT EXISTS public.medical_release_forms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Patient
  patient_name    text NOT NULL,
  date_of_birth   date NOT NULL,
  ssn             text NOT NULL,
  street_address  text NOT NULL,
  city            text NOT NULL,
  state           text NOT NULL,
  zip             text NOT NULL,

  -- Provider authorised to release the records
  provider_name   text NOT NULL,   -- OB physician, OB clinic, or delivery hospital
  provider_phone  text NOT NULL,
  provider_fax    text,

  -- Signature
  printed_name    text NOT NULL,
  signature_png   text NOT NULL,   -- base64-encoded PNG of the drawn signature
  signed_at       timestamptz NOT NULL DEFAULT now(),

  form_version    text NOT NULL DEFAULT '2026-09',
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.medical_release_forms IS
  'Signed Surrogate Release of Medical Records forms (PHI). One row per surrogate.';

ALTER TABLE public.medical_release_forms ENABLE ROW LEVEL SECURITY;

-- The surrogate can read and submit her own form. A signed release is not
-- editable by her afterwards; if it has to be redone, an admin deletes the row
-- and the app asks her to sign again.
DROP POLICY IF EXISTS "medical_release_select_own" ON public.medical_release_forms;
CREATE POLICY "medical_release_select_own" ON public.medical_release_forms
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "medical_release_insert_own" ON public.medical_release_forms;
CREATE POLICY "medical_release_insert_own" ON public.medical_release_forms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Agency admins / staff: full access.
DROP POLICY IF EXISTS "medical_release_admin_all" ON public.medical_release_forms;
CREATE POLICY "medical_release_admin_all" ON public.medical_release_forms
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- Table privileges (row access is still decided by the policies above).
REVOKE ALL ON public.medical_release_forms FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_release_forms TO authenticated;
GRANT ALL ON public.medical_release_forms TO service_role;
