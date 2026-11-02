-- When profile / form2 completion flags are true, store first completion time for admin + reporting.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS form_2_completed_at    TIMESTAMPTZ;

-- Approximate historical times (exact completion time was never stored).
UPDATE public.users u
SET profile_completed_at = COALESCE(u.profile_completed_at, u.updated_at)
WHERE u.profile_completed IS TRUE
  AND u.profile_completed_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'form_2_completed'
  ) THEN
    EXECUTE $f$
      UPDATE public.users u
      SET form_2_completed_at = COALESCE(u.form_2_completed_at, u.updated_at)
      WHERE u.form_2_completed IS TRUE
        AND u.form_2_completed_at IS NULL
    $f$;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'form2_completed'
  ) THEN
    EXECUTE $f$
      UPDATE public.users u
      SET form_2_completed_at = COALESCE(u.form_2_completed_at, u.updated_at)
      WHERE u.form2_completed IS TRUE
        AND u.form_2_completed_at IS NULL
    $f$;
  END IF;
END $$;
