-- ============================================================================
-- Migration: Access Codes Section Master Password Protection
-- Date: 2026-11-05
--
-- 1. Creates public.admin_security_settings table to store security configurations
--    including the hashed and retrieved master password for Access Codes.
-- 2. Seeds initial password 'Welcome@123' safely.
-- 3. Enables RLS to prevent unauthorized direct client access.
-- 4. Provides public.verify_access_codes_password(entered_password) for authentication.
-- 5. Provides public.get_access_codes_password() to display the current password to admins.
-- 6. Provides public.set_access_codes_password(new_password) to change it from DB or UI.
-- 7. Provides public.reset_access_codes_password() to restore the default password.
-- ============================================================================

-- 1. Ensure pgcrypto extension is installed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create admin_security_settings table
CREATE TABLE IF NOT EXISTS public.admin_security_settings (
  key TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Ensure column exists if table was previously created without it
ALTER TABLE public.admin_security_settings ADD COLUMN IF NOT EXISTS password_value TEXT;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.admin_security_settings ENABLE ROW LEVEL SECURITY;

-- 4. Seed initial password as 'Welcome@123' if not already configured
INSERT INTO public.admin_security_settings (key, password_hash, password_value, updated_at)
VALUES (
  'access_codes_password',
  crypt('Welcome@123', gen_salt('bf')),
  'Welcome@123',
  now()
)
ON CONFLICT (key) DO UPDATE
SET password_value = COALESCE(public.admin_security_settings.password_value, 'Welcome@123');

-- 5. Stored function to verify entered password against the stored bcrypt hash / value
CREATE OR REPLACE FUNCTION public.verify_access_codes_password(entered_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_val TEXT;
BEGIN
  IF entered_password IS NULL OR length(trim(entered_password)) = 0 THEN
    RETURN FALSE;
  END IF;

  SELECT password_hash, password_value INTO v_hash, v_val
  FROM public.admin_security_settings
  WHERE key = 'access_codes_password';

  IF v_hash IS NULL AND v_val IS NULL THEN
    RETURN (trim(entered_password) = 'Welcome@123');
  END IF;

  IF v_hash IS NOT NULL AND v_hash = crypt(trim(entered_password), v_hash) THEN
    RETURN TRUE;
  END IF;

  IF v_val IS NOT NULL AND v_val = trim(entered_password) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_access_codes_password(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_access_codes_password(TEXT) TO anon;

-- 6. Stored function to fetch current master password for authenticated staff/admin
CREATE OR REPLACE FUNCTION public.get_access_codes_password()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_val TEXT;
BEGIN
  SELECT password_value INTO v_val
  FROM public.admin_security_settings
  WHERE key = 'access_codes_password';

  RETURN COALESCE(v_val, 'Welcome@123');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_access_codes_password() TO authenticated;

-- 7. Stored procedure to safely update the password from DB or admin UI
CREATE OR REPLACE FUNCTION public.set_access_codes_password(new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF new_password IS NULL OR length(trim(new_password)) < 4 THEN
    RAISE EXCEPTION 'Password must be at least 4 characters long.';
  END IF;

  INSERT INTO public.admin_security_settings (key, password_hash, password_value, updated_at)
  VALUES (
    'access_codes_password',
    crypt(trim(new_password), gen_salt('bf')),
    trim(new_password),
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET password_hash = crypt(trim(new_password), gen_salt('bf')),
      password_value = trim(new_password),
      updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_access_codes_password(TEXT) TO authenticated;

-- 8. Stored procedure to reset password to Welcome@123
CREATE OR REPLACE FUNCTION public.reset_access_codes_password()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.admin_security_settings (key, password_hash, password_value, updated_at)
  VALUES (
    'access_codes_password',
    crypt('Welcome@123', gen_salt('bf')),
    'Welcome@123',
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET password_hash = crypt('Welcome@123', gen_salt('bf')),
      password_value = 'Welcome@123',
      updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_access_codes_password() TO authenticated;

COMMENT ON FUNCTION public.verify_access_codes_password(TEXT) IS 'Verifies the entered master password for Access Codes section.';
COMMENT ON FUNCTION public.get_access_codes_password() IS 'Retrieves current master password for Access Codes section.';
COMMENT ON FUNCTION public.set_access_codes_password(TEXT) IS 'Changes the master password for the Access Codes section.';
COMMENT ON FUNCTION public.reset_access_codes_password() IS 'Resets master password to default Welcome@123.';
