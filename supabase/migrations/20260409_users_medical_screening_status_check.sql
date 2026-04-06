-- Admin UI (GC_MEDICAL_SCREENING_STATUSES) saves values like "Medically Cleared for Program".
-- Older migrations added CHECK (medical_screening_status IN ('Pending', 'In Review', 'Cleared', 'Rejected'))
-- which rejects every real admin update → "Failed to update medical status".

-- 1) Drop any CHECK constraint that mentions medical_screening_status
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

-- 2) Ensure column exists with app default
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS medical_screening_status text DEFAULT 'Not Started';

ALTER TABLE public.users
  ALTER COLUMN medical_screening_status SET DEFAULT 'Not Started';

-- 3) Map legacy four-value schema to current app labels
UPDATE public.users
SET medical_screening_status = CASE trim(medical_screening_status)
  WHEN 'Pending' THEN 'Not Started'
  WHEN 'In Review' THEN 'Under Medical Review'
  WHEN 'Cleared' THEN 'Medically Cleared for Program'
  WHEN 'Rejected' THEN 'Medically Not Cleared'
  ELSE medical_screening_status
END
WHERE medical_screening_status IN ('Pending', 'In Review', 'Cleared', 'Rejected');

-- 4) Normalize any other unknown values so the new CHECK can be applied
UPDATE public.users
SET medical_screening_status = 'Not Started'
WHERE medical_screening_status IS NOT NULL
  AND medical_screening_status NOT IN (
    'Not Started',
    'Records Requested',
    'Records Partially Received',
    'Under Medical Review',
    'Medically Cleared for Program',
    'Medically Not Cleared',
    'On Hold – Needs Follow-Up'
  );

-- 5) Align with GC_MEDICAL_SCREENING_STATUSES (types/index.ts) — en dash in "On Hold – Needs Follow-Up"
ALTER TABLE public.users
  ADD CONSTRAINT users_medical_screening_status_check
  CHECK (
    medical_screening_status IS NULL
    OR medical_screening_status IN (
      'Not Started',
      'Records Requested',
      'Records Partially Received',
      'Under Medical Review',
      'Medically Cleared for Program',
      'Medically Not Cleared',
      'On Hold – Needs Follow-Up'
    )
  );
