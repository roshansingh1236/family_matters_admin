-- Migration: 20261104_users_medical_screening_status_psych_eval.sql
-- Add "Psych Evaluation Referral Sent" and "Psych Evaluation Report Received"
-- to medical_screening_status check constraint and allow all admin statuses.

-- 1) Drop any check constraint referencing medical_screening_status
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'users'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%medical_screening_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 2) Ensure column exists with default
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS medical_screening_status text DEFAULT 'Not Started';

ALTER TABLE public.users
  ALTER COLUMN medical_screening_status SET DEFAULT 'Not Started';

-- 3) Add updated check constraint allowing all admin statuses
ALTER TABLE public.users
  ADD CONSTRAINT users_medical_screening_status_check
  CHECK (
    medical_screening_status IS NULL
    OR medical_screening_status IN (
      'Not Started',
      'Medical Records Requested',
      'Medical Records Received',
      'Medical Records Reviewed',
      'Medical Screening Scheduled',
      'Psych Evaluation Referral Sent',
      'Psych Evaluation Report Received',
      'Medically Cleared for Program',
      'Declined for Program',
      -- Exact uppercase and typo variants
      'PSYCH EVALUATION REFERRAL SENT',
      'PSYCH EVALUATION REPORT RECEIVED',
      'PSYCH EVALUATION REPORT RECIEVED',
      -- Legacy compatibility variants
      'Records Requested',
      'Records Partially Received',
      'Under Medical Review',
      'Medically Not Cleared',
      'On Hold – Needs Follow-Up',
      'On Hold - Needs Follow-Up',
      'In Review',
      'Cleared',
      'Pending'
    )
  );

