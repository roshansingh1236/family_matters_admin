-- ============================================================================
-- DIAGNOSE + FIX: new users (e.g. Surrogates) ending up as role "Admin"
-- ============================================================================
--
-- WHAT WAS GOING WRONG
-- --------------------
-- 1) Function public.handle_new_user() (older versions) did:
--      raw_role := COALESCE(new.raw_user_meta_data->>'role', 'Admin');
--    So if sign-up did not put `role` inside user metadata, Postgres assumed Admin.
--
-- 2) The CASE statement used:
--      ELSE final_role := 'Admin';
--    So any string that did not exactly match a known alias (after LOWER) also
--    became Admin. Examples that FAILED the old match list:
--      - "Agency" (your Flutter select_role_screen uses this; only "agency staff"
--        style strings were mapped — not plain "agency")
--      - Leading/trailing spaces: "Surrogate " did not match 'surrogate'
--      - Custom labels from an admin tool
--
-- 3) If the trigger was attached as AFTER INSERT OR UPDATE on auth.users, then
--    any later auth update (e.g. email confirmed) could re-run the function and
--    overwrite public.users.role again with the bad default.
--
-- HOW TO VERIFY ON YOUR PROJECT (run in SQL editor)
-- -------------------------------------------------
-- Uncomment and run the diagnostic block at the bottom of this file.
--
-- FIX APPLIED BELOW
-- -----------------
-- - Read role from user metadata first, then app metadata.
-- - TRIM + LOWER for matching; extra aliases (including "agency" -> Agency Staff).
-- - Unknown / empty role -> NULL on public.users.role (column is nullable) so you
--   do not silently get Admin; the app upsert (createOrUpdateUser) can still set it.
-- - ON CONFLICT: do NOT overwrite an existing role (app owns corrections).
-- - Trigger fires on INSERT only (not on every auth.users update).
-- ============================================================================

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

-- ============================================================================
-- OPTIONAL DIAGNOSTICS (run manually; comment out if applying via migration only)
-- ============================================================================
/*
-- Current trigger definition
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);

-- Recent auth users and the role string seen by the trigger
SELECT
  id,
  email,
  created_at,
  raw_user_meta_data->>'role'   AS meta_role,
  raw_app_meta_data->>'role'    AS app_meta_role,
  raw_user_meta_data->>'first_name' AS meta_first,
  raw_user_meta_data            AS raw_meta_sample
FROM auth.users
ORDER BY created_at DESC
LIMIT 25;

-- public.users rows where role is Admin (spot-check new signups)
SELECT u.id, u.email, u.role, u.created_at, u.full_name
FROM public.users u
WHERE u.role = 'Admin'
ORDER BY u.created_at DESC
LIMIT 25;
*/
