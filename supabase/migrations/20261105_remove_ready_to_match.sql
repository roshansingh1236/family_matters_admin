-- ============================================================================
-- Migration: Remove "Ready to Match" status and shift functionality to "Accepted to Program"
-- Date: 2026-11-05
--
-- 1. Migrates all existing users with status 'Ready to Match' or 'Accepted into Program'
--    to the canonical 'Accepted to Program'.
-- 2. Updates triggers (handle_match_deleted, handle_match_lifecycle_transitions,
--    handle_match_presented) to reset/set surrogate status to 'Accepted to Program'.
-- ============================================================================

-- 1. Migrate existing users to canonical 'Accepted to Program'
UPDATE public.users
SET status = 'Accepted to Program'
WHERE status IN ('Ready to Match', 'Accepted into Program');

-- 2. Update handle_match_deleted trigger function
CREATE OR REPLACE FUNCTION public.handle_match_deleted()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset the intended parent's status to Match Pending
    IF OLD.intended_parent_id IS NOT NULL THEN
        UPDATE public.users 
        SET status = 'Match Pending'
        WHERE id = OLD.intended_parent_id;
    END IF;

    -- Reset the surrogate's status to Accepted to Program (formerly Ready to Match)
    IF OLD.gestational_carrier_id IS NOT NULL THEN
        UPDATE public.users 
        SET status = 'Accepted to Program'
        WHERE id = OLD.gestational_carrier_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update handle_match_lifecycle_transitions trigger function
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

            -- Reset to the role-specific MATCH-ELIGIBLE status:
            --   Intended Parents -> 'Match Pending'
            --   Surrogates       -> 'Accepted to Program' (formerly 'Ready to Match')
            IF p_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Match Pending' WHERE id = p_id;
            END IF;
            IF s_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Accepted to Program' WHERE id = s_id;
            END IF;
        END IF;
    END IF;

    -- 2. Dual acceptance -> 'Accepted' (NOT Active).
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

    -- 3. On entering Active (admin activation, after the checklist), auto-create the Journey.
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

-- 4. Update handle_match_presented trigger function
CREATE OR REPLACE FUNCTION public.handle_match_presented()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('Proposed', 'Presented') THEN
        IF NEW.intended_parent_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Match Pending'
             WHERE id = NEW.intended_parent_id;
        END IF;
        IF NEW.gestational_carrier_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Accepted to Program'
             WHERE id = NEW.gestational_carrier_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
