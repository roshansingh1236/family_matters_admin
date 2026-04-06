-- Fix: handle_new_user trigger was firing on INSERT OR UPDATE, causing role to
-- be reset to 'Admin' whenever auth.users was updated (e.g. email confirmation).
-- Now fires on INSERT only. Also fixes the ELSE fallback to use a neutral default.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  raw_role   TEXT;
  final_role TEXT;
  f_name     TEXT;
  l_name     TEXT;
BEGIN
  raw_role := new.raw_user_meta_data->>'role';

  IF raw_role IS NULL OR TRIM(raw_role) = '' THEN
    final_role := 'Pending';
  ELSE
    CASE
      WHEN LOWER(raw_role) IN ('admin','administrator')                                      THEN final_role := 'Admin';
      WHEN LOWER(raw_role) IN ('agency staff','agencystaff','agency_staff','staff')          THEN final_role := 'Agency Staff';
      WHEN LOWER(raw_role) IN ('intended parent','intendedparent','parent','ip')             THEN final_role := 'Intended Parent';
      WHEN LOWER(raw_role) IN ('surrogate','gestational carrier','gestationalcarrier','gc')  THEN final_role := 'Surrogate';
      ELSE final_role := 'Pending';
    END CASE;
  END IF;

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
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.users.first_name),
    last_name  = COALESCE(NULLIF(EXCLUDED.last_name,  ''), public.users.last_name),
    full_name  = COALESCE(NULLIF(EXCLUDED.full_name,  ''), public.users.full_name);
    -- Note: role is NOT overwritten on conflict — app upsert owns role
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger (was AFTER INSERT OR UPDATE) and recreate as INSERT only
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
