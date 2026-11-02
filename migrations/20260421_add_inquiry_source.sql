-- Adds a dedicated `inquiry_source` column to `users` so we can tell where
-- phone-inquiry callers came from (Website, App, Referral, Social Media,
-- Event, Other / free text).
--
-- Today the existing `source` column only distinguishes online vs phone;
-- "how did you hear about us" is captured separately here so we don't
-- overload that field. Nullable on purpose so historical rows stay valid.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS inquiry_source TEXT;

CREATE INDEX IF NOT EXISTS idx_users_inquiry_source
  ON public.users (inquiry_source);
