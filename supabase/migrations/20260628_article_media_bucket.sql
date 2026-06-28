-- Add articles_media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('articles_media', 'articles_media', true, 524288000, null)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to articles_media bucket
DROP POLICY IF EXISTS "Articles Media Public Access" ON storage.objects;
CREATE POLICY "Articles Media Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'articles_media' );

-- Allow authenticated users to insert files (admins/staff typically authenticated)
DROP POLICY IF EXISTS "Articles Media Auth Users Insert" ON storage.objects;
CREATE POLICY "Articles Media Auth Users Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'articles_media' AND auth.role() = 'authenticated' );

-- Allow users to update their own files
DROP POLICY IF EXISTS "Articles Media Auth Users Update" ON storage.objects;
CREATE POLICY "Articles Media Auth Users Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'articles_media' AND auth.role() = 'authenticated' );

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Articles Media Auth Users Delete" ON storage.objects;
CREATE POLICY "Articles Media Auth Users Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'articles_media' AND auth.role() = 'authenticated' );

-- Add media_assets JSONB array to articles table
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS media_assets jsonb DEFAULT '[]'::jsonb;
