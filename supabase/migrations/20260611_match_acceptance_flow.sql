-- ============================================================================
-- Match acceptance flow fixes (2026-06-11)
--
-- Client review: presenting a match must prompt BOTH the IP and the Surrogate
-- to accept (and agree to terms). Both accept -> match confirmed + journey
-- begins. Either declines -> match declined and BOTH become eligible to be
-- presented/re-matched again.
--
-- The dual-accept -> Active -> auto-journey machinery already exists
-- (20260307_match_auto_cancellation.sql). This migration fixes two gaps:
--   1. On decline, users were reset to 'Accepted to Program', which is NOT a
--      match-eligible status (admin lists require IP='Match Pending',
--      GC='Ready to Match'), so declined users could never be re-presented.
--      We now reset role-aware so they immediately re-appear as eligible.
--   2. On dual acceptance we also mark both users 'Matched' and stamp
--      matches.matched_at, so the portal reflects the confirmed match.
--
-- Also (idempotent safety net) ensures matches.data exists — the Match
-- Progression checklist persists into matches.data.checklist and silently
-- fails to save if the column is missing on the live database.
--
-- Everything is idempotent and safe to re-run.
-- ============================================================================

-- ─── 0. Checklist column safety net ────────────────────────────────────────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

-- ─── 1. Role-aware lifecycle trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_match_lifecycle_transitions()
RETURNS TRIGGER AS $$
DECLARE
    p_id UUID;
    s_id UUID;
    new_journey_id UUID;
    case_no TEXT;
BEGIN
    p_id := NEW.intended_parent_id;       -- Intended Parent
    s_id := NEW.gestational_carrier_id;   -- Surrogate / Gestational Carrier

    -- 1. Decline -> Cancel the match and make BOTH parties re-presentable.
    IF (NEW.parent_declined = TRUE OR NEW.surrogate_declined = TRUE) THEN
        IF NEW.status != 'Cancelled' THEN
            NEW.status := 'Cancelled';

            -- Reset to the role-specific MATCH-ELIGIBLE status so the admin's
            -- eligible lists pick them up again immediately.
            --   getEligibleParents()    -> users.status = 'Match Pending'
            --   getEligibleSurrogates() -> users.status = 'Ready to Match'
            IF p_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Match Pending'  WHERE id = p_id;
            END IF;
            IF s_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Ready to Match' WHERE id = s_id;
            END IF;
        END IF;
    END IF;

    -- 2. Dual acceptance -> 'Accepted' (NOT Active). The match is confirmed by
    --    both parties, but the journey only begins once the admin completes the
    --    Match Progression checklist and explicitly activates it. Stamp
    --    matched_at and mark both users 'Matched' so the portal/app reflect the
    --    confirmed match.
    IF (NEW.parent_accepted = TRUE AND NEW.surrogate_accepted = TRUE)
       AND (OLD.parent_accepted = FALSE OR OLD.surrogate_accepted = FALSE) THEN
        IF NEW.status NOT IN ('Active', 'Delivered', 'Escrow Closure', 'Completed') THEN
            NEW.status := 'Accepted';
        END IF;
        IF NEW.matched_at IS NULL THEN
            NEW.matched_at := NOW();
        END IF;
        IF p_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Matched' WHERE id = p_id;
        END IF;
        IF s_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Matched' WHERE id = s_id;
        END IF;
    END IF;

    -- 3. On entering Active (admin activation, after the checklist), auto-create
    --    the Journey if one doesn't exist.
    IF (NEW.status = 'Active' AND (OLD.status IS NULL OR OLD.status != 'Active')) THEN
        IF NOT EXISTS (SELECT 1 FROM public.journeys WHERE match_id = NEW.id) THEN
            case_no := 'CASE-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || SUBSTR(CAST(NEW.id AS TEXT), 1, 4);

            INSERT INTO public.journeys (
                match_id,
                parent_id,
                surrogate_id,
                case_manager_id,
                status,
                stage,
                case_number,
                created_at
            ) VALUES (
                NEW.id,
                p_id,
                s_id,
                NEW.coordinator_id,
                'Active',
                'Medical Screening',
                case_no,
                NOW()
            ) RETURNING id INTO new_journey_id;

            NEW.journey_id := new_journey_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_match_lifecycle_transitions ON public.matches;
CREATE TRIGGER tr_handle_match_lifecycle_transitions
BEFORE UPDATE OF parent_declined, surrogate_declined, parent_accepted, surrogate_accepted, status ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_lifecycle_transitions();

-- ─── 2. When a match is PRESENTED, mark both users 'Presented' ─────────────
-- Fires on INSERT (admin creates/presents a match) so each user's status
-- reflects that they have a match awaiting their decision.
CREATE OR REPLACE FUNCTION public.handle_match_presented()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('Proposed', 'Presented') THEN
        IF NEW.intended_parent_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Match Pending'
             WHERE id = NEW.intended_parent_id;
        END IF;
        IF NEW.gestational_carrier_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Ready to Match'
             WHERE id = NEW.gestational_carrier_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_match_presented ON public.matches;
CREATE TRIGGER tr_handle_match_presented
AFTER INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_presented();
