-- Mark auth email as confirmed (sets email_confirmed_at) so login/sign-in is allowed.
-- Change :target if you need a different address.

DO $$
DECLARE
  target constant text := 'roshanpratap1235@gmail.com';
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
