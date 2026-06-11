-- ============================================================================
-- Match acceptance flow fixes Pt 2 (2026-06-11)
--
-- This migration updates the handle_match_presented trigger so that when a 
-- match is presented, both the Intended Parent and Surrogate receive an 
-- automated Task prompting them to review the match.
-- 
-- It also enforces the matches.data column exists to ensure the progression 
-- checklist saves properly.
-- ============================================================================

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS matched_at timestamptz;

-- 1. When a match is PRESENTED, mark both users 'Presented' and generate tasks
CREATE OR REPLACE FUNCTION public.handle_match_presented()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('Proposed', 'Presented') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('Proposed', 'Presented')) THEN
        -- Intended Parent side
        IF NEW.intended_parent_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Match Pending'
             WHERE id = NEW.intended_parent_id;
             
            INSERT INTO public.tasks (user_id, title, description, priority, status, due_date)
            VALUES (
                NEW.intended_parent_id, 
                'Review Match Proposal', 
                'A new match has been presented to you. Please review the details and accept or decline.', 
                'High', 
                'Pending', 
                CURRENT_DATE + INTERVAL '3 days'
            );
        END IF;

        -- Gestational Carrier side
        IF NEW.gestational_carrier_id IS NOT NULL THEN
            UPDATE public.users SET status = 'Ready to Match'
             WHERE id = NEW.gestational_carrier_id;
             
            INSERT INTO public.tasks (user_id, title, description, priority, status, due_date)
            VALUES (
                NEW.gestational_carrier_id, 
                'Review Match Proposal', 
                'A new match has been presented to you. Please review the details and accept or decline.', 
                'High', 
                'Pending', 
                CURRENT_DATE + INTERVAL '3 days'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_match_presented ON public.matches;
CREATE TRIGGER tr_handle_match_presented
AFTER INSERT OR UPDATE OF status ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_presented();
