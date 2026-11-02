-- Adds agency-approval columns to the users table.
--
-- Product intent: after a user completes their registration forms, the
-- Complete Profile / Pending Match / Trust Account sections on the mobile
-- dashboard are hidden until an agency admin flips `agency_approved` to
-- true. The mobile app (surrogacyapp) reads both `agency_approved` and the
-- string fallback `approval_status = 'approved'` to unlock those sections.
--
-- Run this migration in the Supabase SQL editor (or via the Supabase CLI)
-- BEFORE rolling out the gating logic on the mobile app.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agency_approved BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agency_approved_at TIMESTAMPTZ;

-- Helpful index for admin dashboards that filter by approval state.
CREATE INDEX IF NOT EXISTS idx_users_agency_approved
  ON public.users (agency_approved);

COMMENT ON COLUMN public.users.agency_approved IS
  'True once agency staff has reviewed and approved this user. Gates mobile '
  'app matching / trust account access in the surrogacy Flutter app.';

COMMENT ON COLUMN public.users.agency_approved_at IS
  'Timestamp of the most recent approval flip (null when not approved).';
