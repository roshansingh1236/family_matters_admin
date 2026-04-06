-- Mark Supabase Auth email as confirmed for testparent@gmail.com.
-- Note: The Flutter app uses Firebase Auth (emailVerified), not Supabase — see
-- surrogacy_app/lib/utils/email_verification_dev.dart for local debug bypass, or
-- set emailVerified via Firebase Admin SDK for real verification.

DO $$
DECLARE
  target constant text := 'testparent@gmail.com';
  n int;
BEGIN
  UPDATE auth.users
  SET
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = ''
  WHERE lower(trim(email)) = lower(trim(target));

  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    RAISE NOTICE 'No auth.users row for % — create the user first or fix the email.', target;
  ELSE
    RAISE NOTICE 'Email confirmed for % (% row(s)).', target, n;
  END IF;
END $$;
