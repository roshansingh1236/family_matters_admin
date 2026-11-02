-- Reset auth password for testadmin@familymatters.com (bcrypt, same as seed migrations)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET
  encrypted_password = crypt('test123', gen_salt('bf')),
  updated_at = now()
WHERE lower(trim(email)) = lower(trim('testadmin@familymatters.com'));
