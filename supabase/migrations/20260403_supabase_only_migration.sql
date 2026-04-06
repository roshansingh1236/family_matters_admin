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
  raw_role   TEXT;
  final_role TEXT;
  f_name     TEXT;
  l_name     TEXT;
BEGIN
  raw_role := COALESCE(new.raw_user_meta_data->>'role', 'Admin');
  CASE
    WHEN LOWER(raw_role) IN ('admin','administrator')                                      THEN final_role := 'Admin';
    WHEN LOWER(raw_role) IN ('agency staff','agencystaff','agency_staff','staff')          THEN final_role := 'Agency Staff';
    WHEN LOWER(raw_role) IN ('intended parent','intendedparent','parent','ip')             THEN final_role := 'Intended Parent';
    WHEN LOWER(raw_role) IN ('surrogate','gestational carrier','gestationalcarrier','gc')  THEN final_role := 'Surrogate';
    ELSE final_role := 'Admin';
  END CASE;

  -- Prefer explicit first_name/last_name; fall back to splitting full_name
  f_name := COALESCE(
    new.raw_user_meta_data->>'first_name',
    split_part(new.raw_user_meta_data->>'full_name', ' ', 1),
    ''
  );
  l_name := COALESCE(
    new.raw_user_meta_data->>'last_name',
    substring(new.raw_user_meta_data->>'full_name' FROM position(' ' IN new.raw_user_meta_data->>'full_name') + 1),
    ''
  );

  INSERT INTO public.users (id, email, first_name, last_name, full_name, role, status)
  VALUES (
    new.id,
    new.email,
    f_name,
    l_name,
    TRIM(f_name || ' ' || l_name),
    final_role,
    'Pending Review'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name  = COALESCE(EXCLUDED.last_name,  public.users.last_name),
    full_name  = COALESCE(EXCLUDED.full_name,  public.users.full_name),
    role       = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
