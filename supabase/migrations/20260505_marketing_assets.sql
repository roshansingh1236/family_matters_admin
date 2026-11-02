-- Create marketing_assets table for dynamic folder management
-- This allows admins to add new folders without code changes

CREATE TABLE IF NOT EXISTS public.marketing_assets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    folder_id TEXT NOT NULL, -- e.g. 'design_files', 'videos'
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins can manage all marketing assets" ON public.marketing_assets;
CREATE POLICY "Admins can manage all marketing assets" 
    ON public.marketing_assets FOR ALL 
    USING ( (SELECT (role::text IN ('Admin', 'Agency Staff', 'agencyStaff')) FROM public.users WHERE id::text = auth.uid()::text) );

DROP POLICY IF EXISTS "Public can view marketing assets" ON public.marketing_assets;
CREATE POLICY "Public can view marketing assets" 
    ON public.marketing_assets FOR SELECT 
    USING (true);

-- Enable Realtime
ALTER TABLE public.marketing_assets REPLICA IDENTITY FULL;
