-- ============================================================================
-- MIGRATION: Schema Gap Fixes
-- Date: 2026-04-03
-- Purpose: Add missing columns required by matchService/journeyService, fix
--          postpartum_notes type mismatch, and fix the journey auto-creation
--          trigger that inserts status='Medical Screening' (violates the
--          'Active'/'Completed'/'Cancelled' CHECK constraint from 20260310).
-- ============================================================================

-- ============================================================================
-- PART 1: MATCHES — Add matched_at if missing
-- (supabase_schema.sql only creates it for brand-new tables via CREATE TABLE;
--  ALTER TABLE path was never covered for existing databases)
-- ============================================================================
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- PART 2: JOURNEYS — Add medical_records and legal_agreements columns
-- (used by journeyService.updateMedicalRecords / updateLegalAgreements)
-- ============================================================================
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS medical_records JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS legal_agreements JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- PART 3: JOURNEYS — Fix postpartum_notes type
-- 20260310 added it as JSONB, but journeyService.updatePostpartumNotes sends
-- a plain TEXT string. Alter to TEXT so writes don't fail.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'journeys'
      AND column_name  = 'postpartum_notes'
      AND data_type    = 'jsonb'
  ) THEN
    ALTER TABLE public.journeys
      ALTER COLUMN postpartum_notes TYPE TEXT USING postpartum_notes::text;
  END IF;
END $$;

-- If the column doesn't exist yet, add it as TEXT
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS postpartum_notes TEXT;

-- ============================================================================
-- PART 4: USERS — Add form_data and medical_screening_status
-- (form_data is referenced throughout matchService/journeyService;
--  medical_screening_status is used for GC eligibility checks)
-- ============================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS medical_screening_status TEXT
  CHECK (medical_screening_status IN ('Pending', 'In Review', 'Cleared', 'Rejected'));

-- ============================================================================
-- PART 5: Fix the journey auto-creation trigger
-- 20260307 trigger inserts journeys with status='Medical Screening', which
-- violates the CHECK constraint added in 20260310 that only allows
-- 'Active', 'Completed', 'Cancelled'. Fix: use status='Active', stage='Medical Screening'.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_match_lifecycle_transitions()
RETURNS TRIGGER AS $$
DECLARE
    p_id UUID;
    s_id UUID;
    new_journey_id UUID;
    case_no TEXT;
BEGIN
    p_id := NEW.intended_parent_id;
    s_id := NEW.gestational_carrier_id;

    -- 1. Automatic Cancellation
    IF (NEW.parent_declined = TRUE OR NEW.surrogate_declined = TRUE) THEN
        IF NEW.status != 'Cancelled' THEN
            NEW.status := 'Cancelled';
            IF p_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Accepted to Program' WHERE id = p_id;
            END IF;
            IF s_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Accepted to Program' WHERE id = s_id;
            END IF;
        END IF;
    END IF;

    -- 2. Automatic Activation (both parties accepted)
    IF (NEW.parent_accepted = TRUE AND NEW.surrogate_accepted = TRUE)
       AND (OLD.parent_accepted = FALSE OR OLD.surrogate_accepted = FALSE)
    THEN
        NEW.status := 'Active';
    END IF;

    -- 3. Automatic Journey Creation
    --    FIX: status must be 'Active' (not 'Medical Screening') per journeys_status_check constraint
    IF (NEW.status = 'Active' AND (OLD.status IS NULL OR OLD.status != 'Active')) THEN
        IF NOT EXISTS (SELECT 1 FROM public.journeys WHERE match_id = NEW.id) THEN
            case_no := 'CASE-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || SUBSTR(CAST(NEW.id AS TEXT), 1, 4);

            INSERT INTO public.journeys (
                match_id,
                parent_id,
                surrogate_id,
                status,
                stage,
                case_number,
                created_at
            ) VALUES (
                NEW.id,
                p_id,
                s_id,
                'Active',              -- was 'Medical Screening' — violates CHECK constraint
                'Medical Screening',   -- operational sub-stage goes here
                case_no,
                NOW()
            ) RETURNING id INTO new_journey_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (DROP + CREATE is idempotent)
DROP TRIGGER IF EXISTS tr_handle_match_lifecycle_transitions ON public.matches;
CREATE TRIGGER tr_handle_match_lifecycle_transitions
BEFORE UPDATE OF parent_declined, surrogate_declined, parent_accepted, surrogate_accepted, status
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_lifecycle_transitions();
