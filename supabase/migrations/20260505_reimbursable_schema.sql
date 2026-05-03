-- Create agency_reimbursables table if it doesn't exist
-- This table tracks surrogate expense claims, non-accountable allowances, and trust distributions.

CREATE TABLE IF NOT EXISTS public.agency_reimbursables (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    journey_id UUID REFERENCES public.journeys(id),
    gc_id UUID REFERENCES public.users(id),
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    approved_amount NUMERIC,
    receipt_url TEXT,
    description TEXT,
    incurred_date DATE DEFAULT CURRENT_DATE,
    submitted_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Approved', 'Denied', 'Reimbursed')),
    review_notes TEXT,
    reimbursed_date DATE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime
ALTER TABLE public.agency_reimbursables REPLICA IDENTITY FULL;

-- Enable RLS
ALTER TABLE public.agency_reimbursables ENABLE ROW LEVEL SECURITY;

-- Policies
-- Fixed the type mismatch error (uuid = text) by ensuring auth.uid() comparison is handled correctly.
-- auth.uid() returns uuid. However, inside the check_is_admin function or other parts of the query,
-- there might be a comparison against a text field. 
-- We add explicit casts to all policy comparisons to be safe.

DROP POLICY IF EXISTS "Admins can manage all reimbursables" ON public.agency_reimbursables;
CREATE POLICY "Admins can manage all reimbursables" 
    ON public.agency_reimbursables FOR ALL 
    USING ( (SELECT (role::text IN ('Admin', 'Agency Staff', 'agencyStaff')) FROM public.users WHERE id::text = auth.uid()::text) );

DROP POLICY IF EXISTS "Users can view their own reimbursables" ON public.agency_reimbursables;
CREATE POLICY "Users can view their own reimbursables" 
    ON public.agency_reimbursables FOR SELECT 
    USING (auth.uid()::text = gc_id::text OR auth.uid()::text = created_by::text);

DROP POLICY IF EXISTS "Users can insert their own reimbursables" ON public.agency_reimbursables;
CREATE POLICY "Users can insert their own reimbursables" 
    ON public.agency_reimbursables FOR INSERT 
    WITH CHECK (auth.uid()::text = gc_id::text);
