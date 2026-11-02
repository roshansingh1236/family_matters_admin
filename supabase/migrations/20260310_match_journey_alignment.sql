-- ============================================================================
-- MIGRATION: Match & Journey Alignment with Surrogacy Platform Specification
-- Date: 2026-03-10
-- Purpose: Align matches/journeys tables with spec statuses, add guardrail columns
-- ============================================================================

-- ============================================================================
-- PART 1: MATCHES TABLE UPDATES
-- ============================================================================

-- 1a. Migrate existing invalid statuses to 'Cancelled'
UPDATE public.matches SET status = 'Cancelled' WHERE status IN ('Dissolved', 'Declined');

-- 1b. Drop old status CHECK constraint and add spec-aligned one
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches 
  ADD CONSTRAINT matches_status_check 
  CHECK (status IN (
    'Proposed',        -- Internal pairing under consideration
    'Presented',       -- Match shown to GC and IP(s)
    'Accepted',        -- Both parties agree to proceed
    'Active',          -- Journey created and operational
    'Delivered',       -- Delivery has occurred
    'Escrow Closure',  -- Post-delivery financial reconciliation
    'Completed',       -- Escrow closed; match archived
    'Cancelled'        -- Terminated early (reason required)
  ));

-- 1c. Add new columns for lifecycle tracking
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS escrow_closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES public.users(id);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS journey_id UUID REFERENCES public.journeys(id);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================================
-- PART 2: JOURNEYS TABLE UPDATES
-- ============================================================================

-- 2a. Add 'stage' column for operational sub-stages within Active journey
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Medical Screening'
  CHECK (stage IN (
    'Medical Screening',
    'Legal',
    'Embryo Transfer',
    'Pregnancy',
    'Birth',
    'Postpartum'
  ));

-- 2b. Add delivery & postpartum tracking columns
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS postpartum_notes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2c. Migrate existing journey statuses to new schema
-- Map all granular statuses to 'Active' with corresponding stage
UPDATE public.journeys SET stage = status, status = 'Active' 
  WHERE status IN ('Medical Screening', 'Legal', 'Embryo Transfer', 'Pregnancy', 'Birth');

-- 2d. Drop old status constraint and add spec-aligned one
ALTER TABLE public.journeys DROP CONSTRAINT IF EXISTS journeys_status_check;
ALTER TABLE public.journeys 
  ADD CONSTRAINT journeys_status_check
  CHECK (status IN ('Active', 'Completed', 'Cancelled'));

-- 2e. Add parent/surrogate ID columns if not already present (from previous migration)
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.users(id);
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS surrogate_id UUID REFERENCES public.users(id);
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS case_manager_id UUID REFERENCES public.users(id);

-- ============================================================================
-- PART 3: RLS POLICIES FOR NEW COLUMNS / UPDATED ACCESS
-- ============================================================================

-- Matches: Allow admin/coordinator full CRUD
DROP POLICY IF EXISTS "matches_admin_full" ON public.matches;
CREATE POLICY "matches_admin_full" ON public.matches FOR ALL
  USING (public.check_is_admin());

-- Matches: Allow participants to view their own matches
DROP POLICY IF EXISTS "matches_participant_view" ON public.matches;
CREATE POLICY "matches_participant_view" ON public.matches FOR SELECT
  USING (
    auth.uid() = intended_parent_id 
    OR auth.uid() = gestational_carrier_id
  );

-- Journeys: Allow admin full CRUD
DROP POLICY IF EXISTS "journeys_admin_full" ON public.journeys;
CREATE POLICY "journeys_admin_full" ON public.journeys FOR ALL
  USING (public.check_is_admin());

-- Journeys: Allow participants to view their own journeys
DROP POLICY IF EXISTS "journeys_participant_view" ON public.journeys;
CREATE POLICY "journeys_participant_view" ON public.journeys FOR SELECT
  USING (
    auth.uid() = parent_id 
    OR auth.uid() = surrogate_id
  );

-- ============================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_ip ON public.matches(intended_parent_id);
CREATE INDEX IF NOT EXISTS idx_matches_gc ON public.matches(gestational_carrier_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON public.journeys(status);
CREATE INDEX IF NOT EXISTS idx_journeys_stage ON public.journeys(stage);
CREATE INDEX IF NOT EXISTS idx_journeys_match_id ON public.journeys(match_id);
