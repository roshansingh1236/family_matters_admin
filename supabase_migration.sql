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
