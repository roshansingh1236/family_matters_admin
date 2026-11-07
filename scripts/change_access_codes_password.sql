-- ============================================================================
-- Family Matters Admin: Script to View / Change Access Codes Master Password
-- 
-- HOW TO USE:
-- 1. Open your Supabase Dashboard -> SQL Editor (or connect via psql).
-- 2. To change the password, run:
--       SELECT public.set_access_codes_password('YourNewPasswordHere');
-- 3. To reset the password back to default (Welcome@123), run:
--       SELECT public.reset_access_codes_password();
-- 4. To check the current active password:
--       SELECT public.get_access_codes_password();
-- ============================================================================

-- Execute update:
SELECT public.set_access_codes_password('YourNewPasswordHere');

-- Verify the update:
SELECT key, password_value, updated_at
FROM public.admin_security_settings
WHERE key = 'access_codes_password';
