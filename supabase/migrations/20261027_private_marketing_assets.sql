-- Marketing Assets: staff-only.
--
-- The files lived under marketing/ in the public `users` bucket and the
-- marketing_assets table was readable by anyone, so anyone with the project
-- URL could list and download them without logging in. This moves them to a
-- private `marketing` bucket that only Admin / Agency Staff
-- (public.check_is_admin()) can read or change. The admin page opens files
-- through short-lived signed links.
--
-- Existing files are moved by the admin page itself the first time a staff
-- member opens each folder (a storage move can't be done from SQL); this file
-- only prepares the bucket, policies and table.
--
-- Safe to run more than once.

-- ─── Private bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing', 'marketing', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "marketing_staff_select" ON storage.objects;
CREATE POLICY "marketing_staff_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'marketing' AND public.check_is_admin());

DROP POLICY IF EXISTS "marketing_staff_insert" ON storage.objects;
CREATE POLICY "marketing_staff_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'marketing' AND public.check_is_admin());

DROP POLICY IF EXISTS "marketing_staff_update" ON storage.objects;
CREATE POLICY "marketing_staff_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'marketing' AND public.check_is_admin())
  WITH CHECK (bucket_id = 'marketing' AND public.check_is_admin());

DROP POLICY IF EXISTS "marketing_staff_delete" ON storage.objects;
CREATE POLICY "marketing_staff_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'marketing' AND public.check_is_admin());

-- ─── Table: staff only, no public links ─────────────────────────────────────

DROP POLICY IF EXISTS "Public can view marketing assets" ON public.marketing_assets;

DROP POLICY IF EXISTS "Admins can manage all marketing assets" ON public.marketing_assets;
CREATE POLICY "Admins can manage all marketing assets" ON public.marketing_assets
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

REVOKE ALL ON public.marketing_assets FROM anon;

-- Where the file is in the private bucket ('<folder>/<file name>').
ALTER TABLE public.marketing_assets ADD COLUMN IF NOT EXISTS storage_path text;

-- file_url held a permanent public link; private files don't have one.
ALTER TABLE public.marketing_assets ALTER COLUMN file_url DROP NOT NULL;

UPDATE public.marketing_assets
   SET storage_path = COALESCE(storage_path, folder_id || '/' || name),
       file_url = NULL
 WHERE file_url IS NOT NULL OR storage_path IS NULL;
