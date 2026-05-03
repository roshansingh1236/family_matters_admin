-- Create a table for external partners (IVF Clinics, Medical Facilities, Lawyers, etc.)
CREATE TABLE IF NOT EXISTS public.external_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('IVF Clinics', 'Medical Facilities', 'Legal Partners', 'Other')),
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.external_partners ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all authenticated users to read external_partners" 
ON public.external_partners FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins to manage external_partners" 
ON public.external_partners FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('Agency Staff', 'Admin')
    )
);

-- Insert some initial data
INSERT INTO public.external_partners (name, category, email, phone, address)
VALUES 
('Pacific Fertility Center', 'IVF Clinics', 'info@pacificfertility.com', '(415) 834-3000', '55 Francisco St, San Francisco, CA'),
('Kindbody', 'IVF Clinics', 'contact@kindbody.com', '(855) 546-3263', '102 5th Ave, New York, NY'),
('Mount Sinai Hospital', 'Medical Facilities', 'records@mountsinai.org', '(212) 241-6500', '1468 Madison Ave, New York, NY'),
('Cedars-Sinai Medical Center', 'Medical Facilities', 'info@cedars-sinai.org', '(310) 423-3277', '8700 Beverly Blvd, Los Angeles, CA')
ON CONFLICT DO NOTHING;
