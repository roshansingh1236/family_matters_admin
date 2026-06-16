-- Migration to handle resetting user statuses when a match is deleted (Unmatched)
CREATE OR REPLACE FUNCTION public.handle_match_deleted()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset the intended parent's status to Match Pending
    IF OLD.intended_parent_id IS NOT NULL THEN
        UPDATE public.users 
        SET status = 'Match Pending'
        WHERE id = OLD.intended_parent_id;
    END IF;

    -- Reset the surrogate's status to Ready to Match
    IF OLD.gestational_carrier_id IS NOT NULL THEN
        UPDATE public.users 
        SET status = 'Ready to Match'
        WHERE id = OLD.gestational_carrier_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_match_deleted ON public.matches;
CREATE TRIGGER tr_handle_match_deleted
BEFORE DELETE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_deleted();

