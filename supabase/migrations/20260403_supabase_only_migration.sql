-- Migration: Full Supabase-only auth — no Firebase
-- Adds columns needed for mobile profile flow and updates the auth trigger.

-- 1. Add profile completion columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_completed  boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS form2_completed    boolean DEFAULT false;

-- 2. Remove firebase_uid bridge (no longer needed)
ALTER TABLE public.users DROP COLUMN IF EXISTS firebase_uid;

-- 3. Update handle_new_user trigger to read first_name/last_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  raw_role   text;
  norm       text;
  final_role text;
  f_name     text;
  l_name     text;
  full_nm    text;
BEGIN
  raw_role := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'role'), ''),
    NULLIF(trim(new.raw_app_meta_data->>'role'), ''),
    NULLIF(trim(new.raw_user_meta_data->>'user_role'), ''),
    ''
  );

  norm := lower(trim(raw_role));

  IF norm = '' THEN
    final_role := NULL;
  ELSE
    CASE
      WHEN norm IN ('admin', 'administrator') THEN
        final_role := 'Admin';
      WHEN norm IN (
        'agency staff', 'agencystaff', 'agency_staff', 'staff', 'agency'
      ) THEN
        final_role := 'Agency Staff';
      WHEN norm IN (
        'intended parent', 'intendedparent', 'parent', 'ip'
      ) THEN
        final_role := 'Intended Parent';
      WHEN norm IN (
        'surrogate',
        'gestational carrier',
        'gestationalcarrier',
        'gestational_carrier',
        'gc',
        'surrogate mother',
        'carrier'
      ) THEN
        final_role := 'Surrogate';
      ELSE
        final_role := NULL;
    END CASE;
  END IF;

  f_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1),
    ''
  );
  l_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    nullif(
      substring(
        coalesce(new.raw_user_meta_data->>'full_name', '')
        FROM position(' ' IN coalesce(new.raw_user_meta_data->>'full_name', '')) + 1
      ),
      ''
    ),
    ''
  );

  full_nm := nullif(trim(f_name || ' ' || l_name), '');

  INSERT INTO public.users AS u (
    id,
    email,
    first_name,
    last_name,
    full_name,
    role,
    status
  )
  VALUES (
    new.id,
    new.email,
    nullif(f_name, ''),
    nullif(l_name, ''),
    full_nm,
    final_role,
    'Pending Review'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = excluded.email,
    first_name = coalesce(nullif(excluded.first_name, ''), u.first_name),
    last_name  = coalesce(nullif(excluded.last_name, ''), u.last_name),
    full_name  = coalesce(nullif(excluded.full_name, ''), u.full_name),
    role       = coalesce(u.role, excluded.role);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
