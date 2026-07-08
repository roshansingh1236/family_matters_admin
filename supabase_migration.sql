-- =============================================================================
-- Family Matters Admin — Supabase Migration
-- Run this in the Supabase SQL editor (Dashboard → SQL → New Query)
-- =============================================================================

-- 1. agency_reimbursables table
-- Tracks reimbursable expenses per Journey, separate from agency fees
CREATE TABLE IF NOT EXISTS agency_reimbursables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id      uuid REFERENCES journeys(id) ON DELETE SET NULL,
  gc_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  category        text NOT NULL,
  amount          numeric(12, 2) NOT NULL,
  approved_amount numeric(12, 2),
  receipt_url     text,
  description     text NOT NULL,
  incurred_date   date NOT NULL,
  submitted_date  date NOT NULL DEFAULT CURRENT_DATE,
  status          text NOT NULL DEFAULT 'Submitted'
                    CHECK (status IN ('Submitted','Under Review','Approved','Partially Approved','Reimbursed','Denied')),
  review_notes    text,
  reimbursed_date date,
  created_by      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_reimbursables_journey ON agency_reimbursables(journey_id);
CREATE INDEX IF NOT EXISTS idx_agency_reimbursables_status  ON agency_reimbursables(status);

-- RLS: only authenticated admin users can access
ALTER TABLE agency_reimbursables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access reimbursables" ON agency_reimbursables;
CREATE POLICY "Admin full access reimbursables"
  ON agency_reimbursables FOR ALL
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- 2. Add record_requests column to users (if missing)
-- Stores medical record requests as a JSONB array on the GC's user row
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS record_requests jsonb DEFAULT '[]'::jsonb;

-- =============================================================================
-- 3. Add pipeline_stage column to users (if missing)
-- Tracks each IP's current pipeline stage (11-stage agency pipeline)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pipeline_stage      text,
  ADD COLUMN IF NOT EXISTS pipeline_updated_at timestamptz;

-- =============================================================================
-- 4. Add medical_screening_status column to users (if missing)
-- Used by GC profiles to track medical clearance state
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS medical_screening_status text DEFAULT 'Not Started';

-- If updates from the admin UI fail with a CHECK constraint error, run the full fix in:
--   supabase/migrations/20260409_users_medical_screening_status_check.sql
-- (Older schemas only allowed Pending/In Review/Cleared/Rejected; the app uses Medically Cleared for Program, etc.)

-- =============================================================================
-- 5. Add decline_reason column to users (if missing)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS decline_reason text;

-- =============================================================================
-- 6. Add intended_parent_id to agency_financials (if missing)
-- Used by agency fee installments linked to an IP directly
ALTER TABLE agency_financials
  ADD COLUMN IF NOT EXISTS intended_parent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference           text,
  ADD COLUMN IF NOT EXISTS waiver_reason       text;

CREATE INDEX IF NOT EXISTS idx_agency_financials_ip ON agency_financials(intended_parent_id);

-- =============================================================================
-- 7. audit_log table
-- Immutable append-only log for all admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_email text,
  action      text NOT NULL,
  entity_type text NOT NULL,  -- 'match', 'journey', 'user', 'transaction', etc.
  entity_id   text,
  before_data jsonb,
  after_data  jsonb,
  ip_address  text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor     ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity    ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Insert audit log" ON audit_log;
DROP POLICY IF EXISTS "Admin read audit log" ON audit_log;
CREATE POLICY "Insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin read audit log"
  ON audit_log FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- 8. contracts table (admin dashboard contractService + e-sign metadata)
CREATE TABLE IF NOT EXISTS contracts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  type             text,
  surrogate_name   text,
  parent_name      text,
  status           text NOT NULL DEFAULT 'draft',
  value            numeric(12, 2),
  surrogate_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  parent_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  journey_id       uuid REFERENCES journeys(id) ON DELETE SET NULL,
  esign_status     text DEFAULT 'Not Sent'
    CHECK (esign_status IN ('Not Sent','Sent to GC','Sent to IP','Partially Signed','Fully Signed','Expired')),
  esign_sent_at    timestamptz,
  esign_signed_at  timestamptz,
  document_url     text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_journey ON contracts(journey_id);
CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_id);
CREATE INDEX IF NOT EXISTS idx_contracts_surrogate ON contracts(surrogate_id);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff full access contracts" ON contracts;
DROP POLICY IF EXISTS "Contracts visible to linked parent or surrogate" ON contracts;
CREATE POLICY "Staff full access contracts"
  ON contracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Agency Staff', 'agencyStaff')
    )
  );

CREATE POLICY "Contracts visible to linked parent or surrogate"
  ON contracts FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = surrogate_id);

-- Surrogate Benefit Packages
CREATE TABLE IF NOT EXISTS public.surrogate_benefit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE NOT NULL UNIQUE,
    surrogate_id UUID REFERENCES public.users(id) NOT NULL,
    signing_bonus DECIMAL(12,2) DEFAULT 2000.00,
    monthly_allowance DECIMAL(12,2) DEFAULT 400.00,
    embryo_transfer_fee DECIMAL(12,2) DEFAULT 1000.00,
    singleton_living_expense DECIMAL(12,2) DEFAULT 65000.00,
    multiples_living_expense DECIMAL(12,2) DEFAULT 10000.00,
    maternity_clothing DECIMAL(12,2) DEFAULT 1000.00,
    housekeeping_allowance DECIMAL(12,2) DEFAULT 1400.00,
    support_group_allowance DECIMAL(12,2) DEFAULT 100.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.surrogate_benefit_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "benefit_packages_view" ON public.surrogate_benefit_packages;
CREATE POLICY "benefit_packages_view" ON public.surrogate_benefit_packages FOR SELECT USING (auth.uid()::text = surrogate_id::text OR public.check_is_admin());
DROP POLICY IF EXISTS "benefit_packages_admin" ON public.surrogate_benefit_packages;
CREATE POLICY "benefit_packages_admin" ON public.surrogate_benefit_packages FOR ALL USING (public.check_is_admin());

-- Payment Schedules
CREATE TABLE IF NOT EXISTS public.payment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) NOT NULL, -- IP or Surrogate
    type TEXT NOT NULL, -- 'Deposit' or 'Compensation'
    title TEXT NOT NULL,
    date_of_occurrence DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'PAID'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_schedules_view" ON public.payment_schedules;
CREATE POLICY "payment_schedules_view" ON public.payment_schedules FOR SELECT USING (auth.uid()::text = user_id::text OR public.check_is_admin());
DROP POLICY IF EXISTS "payment_schedules_admin" ON public.payment_schedules;
CREATE POLICY "payment_schedules_admin" ON public.payment_schedules FOR ALL USING (public.check_is_admin());

-- Trust Accounts
CREATE TABLE IF NOT EXISTS public.trust_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE NOT NULL UNIQUE,
    intended_parent_id UUID REFERENCES public.users(id) NOT NULL,
    total_funded DECIMAL(12,2) DEFAULT 0.00,
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    minimum_balance_required DECIMAL(12,2) DEFAULT 10000.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.trust_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trust_accounts_view" ON public.trust_accounts;
CREATE POLICY "trust_accounts_view" ON public.trust_accounts FOR SELECT USING (auth.uid()::text = intended_parent_id::text OR public.check_is_admin());
DROP POLICY IF EXISTS "trust_accounts_admin" ON public.trust_accounts;
CREATE POLICY "trust_accounts_admin" ON public.trust_accounts FOR ALL USING (public.check_is_admin());

-- Monthly Payment Forms
CREATE TABLE IF NOT EXISTS public.monthly_payment_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surrogate_id UUID REFERENCES public.users(id) NOT NULL,
    journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE NOT NULL,
    month TEXT NOT NULL,
    year TEXT NOT NULL,
    total_amount_requested DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'paid'
    line_items JSONB, -- stores base allowance, twins allowance, transfer, etc.
    receipts JSONB, -- stores paths to uploaded files in storage
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES public.users(id)
);
ALTER TABLE public.monthly_payment_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_payment_forms_view" ON public.monthly_payment_forms;
CREATE POLICY "monthly_payment_forms_view" ON public.monthly_payment_forms FOR SELECT USING (
    auth.uid()::text = surrogate_id::text OR 
    public.check_is_admin() OR 
    EXISTS (SELECT 1 FROM public.journeys j WHERE j.id = monthly_payment_forms.journey_id AND j.intended_parent_id::text = auth.uid()::text)
);
DROP POLICY IF EXISTS "monthly_payment_forms_surrogate" ON public.monthly_payment_forms;
CREATE POLICY "monthly_payment_forms_surrogate" ON public.monthly_payment_forms FOR INSERT WITH CHECK (auth.uid()::text = surrogate_id::text);
DROP POLICY IF EXISTS "monthly_payment_forms_admin" ON public.monthly_payment_forms;
CREATE POLICY "monthly_payment_forms_admin" ON public.monthly_payment_forms FOR UPDATE USING (public.check_is_admin());
DROP POLICY IF EXISTS "monthly_payment_forms_admin_delete" ON public.monthly_payment_forms;
CREATE POLICY "monthly_payment_forms_admin_delete" ON public.monthly_payment_forms FOR DELETE USING (public.check_is_admin());

-- Ensure foreign key constraints are updated to ON DELETE CASCADE for existing tables
ALTER TABLE public.surrogate_benefit_packages DROP CONSTRAINT IF EXISTS surrogate_benefit_packages_journey_id_fkey, ADD CONSTRAINT surrogate_benefit_packages_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES public.journeys(id) ON DELETE CASCADE;
ALTER TABLE public.payment_schedules DROP CONSTRAINT IF EXISTS payment_schedules_journey_id_fkey, ADD CONSTRAINT payment_schedules_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES public.journeys(id) ON DELETE CASCADE;
ALTER TABLE public.trust_accounts DROP CONSTRAINT IF EXISTS trust_accounts_journey_id_fkey, ADD CONSTRAINT trust_accounts_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES public.journeys(id) ON DELETE CASCADE;
ALTER TABLE public.monthly_payment_forms DROP CONSTRAINT IF EXISTS monthly_payment_forms_journey_id_fkey, ADD CONSTRAINT monthly_payment_forms_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES public.journeys(id) ON DELETE CASCADE;
