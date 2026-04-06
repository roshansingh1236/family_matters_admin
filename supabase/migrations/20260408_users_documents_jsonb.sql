-- File list for admin + mobile (same shape as FileUploadSection: name, url, category, uploadedAt, type, path)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
