-- Migration to handle automatic match lifecycle transitions
-- 1. Sets status to 'Cancelled' and resets users if anyone declines.
-- 2. Sets status to 'Active' if BOTH parties accept.
-- 3. Automatically creates a Journey record when status moves to 'Active'.

-- First, ensure the matches table has the necessary columns and status values
DO $$ 
BEGIN
    -- Add columns if missing (safeguard)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'parent_accepted') THEN
        ALTER TABLE public.matches ADD COLUMN parent_accepted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'surrogate_accepted') THEN
        ALTER TABLE public.matches ADD COLUMN surrogate_accepted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'parent_declined') THEN
        ALTER TABLE public.matches ADD COLUMN parent_declined BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'surrogate_declined') THEN
        ALTER TABLE public.matches ADD COLUMN surrogate_declined BOOLEAN DEFAULT FALSE;
    END IF;

    -- Update status check constraint to include all required statuses
    -- We drop the existing constraint if it's restrictive and add a more inclusive one
    ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
    ALTER TABLE public.matches ADD CONSTRAINT matches_status_check 
        CHECK (status IN ('Proposed', 'Presented', 'Accepted', 'Active', 'Delivered', 'Escrow Closure', 'Cancelled', 'Completed', 'Dissolved', 'Declined'));
END $$;

CREATE OR REPLACE FUNCTION public.handle_match_lifecycle_transitions()
RETURNS TRIGGER AS $$
DECLARE
    p_id UUID;
    s_id UUID;
    new_journey_id UUID;
    case_no TEXT;
BEGIN
    -- Get participant IDs (Correct columns for 'matches' table are intended_parent_id and gestational_carrier_id)
    p_id := NEW.intended_parent_id;
    s_id := NEW.gestational_carrier_id;

    -- 1. Automatic Cancellation Logic
    IF (NEW.parent_declined = TRUE OR NEW.surrogate_declined = TRUE) THEN
        -- Only set to Cancelled if it hasn't been cancelled yet to avoid loops or redundant updates
        IF NEW.status != 'Cancelled' THEN
            NEW.status := 'Cancelled';
            
            -- Reset participant statuses to 'Accepted to Program' so they can be matched again
            IF p_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Accepted to Program' WHERE id = p_id;
            END IF;
            
            IF s_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Accepted to Program' WHERE id = s_id;
            END IF;
        END IF;
    END IF;

    -- 2. Automatic Activation Logic (Dual Acceptance)
    IF (NEW.parent_accepted = TRUE AND NEW.surrogate_accepted = TRUE) AND (OLD.parent_accepted = FALSE OR OLD.surrogate_accepted = FALSE) THEN
        NEW.status := 'Active';
    END IF;

    -- 3. Automatic Journey Creation
    IF (NEW.status = 'Active' AND (OLD.status IS NULL OR OLD.status != 'Active')) THEN
        -- Check if journey already exists for this match to prevent duplicates
        IF NOT EXISTS (SELECT 1 FROM public.journeys WHERE match_id = NEW.id) THEN
            case_no := 'CASE-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || SUBSTR(CAST(NEW.id AS TEXT), 1, 4);
            
            INSERT INTO public.journeys (
                match_id,
                parent_id,
                surrogate_id,
                status,
                case_number,
                created_at
            ) VALUES (
                NEW.id,
                p_id,
                s_id,
                'Medical Screening',
                case_no,
                NOW()
            ) RETURNING id INTO new_journey_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_handle_match_lifecycle_transitions ON public.matches;
CREATE TRIGGER tr_handle_match_lifecycle_transitions
BEFORE UPDATE OF parent_declined, surrogate_declined, parent_accepted, surrogate_accepted, status ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_lifecycle_transitions();
