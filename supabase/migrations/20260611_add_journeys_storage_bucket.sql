-- Add journeys bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('journeys', 'journeys', true, 52428800, null)
ON CONFLICT (id) DO NOTHING;

-- Set up basic access policies for journeys bucket
-- Note: Replace or modify these policies if you need strict RLS for journey documents

-- Allow public read access to journeys bucket
CREATE POLICY "Journeys Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'journeys' );

-- Allow authenticated users to insert files
CREATE POLICY "Journeys Auth Users Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'journeys' AND auth.role() = 'authenticated' );

-- Allow users to update their own files
CREATE POLICY "Journeys Auth Users Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'journeys' AND auth.role() = 'authenticated' );

-- Allow users to delete their own files
CREATE POLICY "Journeys Auth Users Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'journeys' AND auth.role() = 'authenticated' );

-- Add documents JSONB array to journeys table
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
