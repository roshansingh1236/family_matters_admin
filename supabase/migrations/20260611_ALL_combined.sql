-- ============================================================================
-- COMBINED migration — 2026-06-11
-- Run top to bottom (Supabase SQL editor). Idempotent / safe to re-run.
-- Sections:
--   A. Match acceptance flow (present -> accept -> gated activation)
--   B. Fix duplicate conversation participants (one-way chat fix)
--   C. Backfill chat threads for existing active matches
--   D. Named group conversations ("Care Team")
-- ============================================================================


-- ============================================================================
-- A. MATCH ACCEPTANCE FLOW
-- ============================================================================
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

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

    -- Decline -> Cancel + make BOTH parties re-presentable (role-aware).
    IF (NEW.parent_declined = TRUE OR NEW.surrogate_declined = TRUE) THEN
        IF NEW.status != 'Cancelled' THEN
            NEW.status := 'Cancelled';
            IF p_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Match Pending'  WHERE id = p_id;
            END IF;
            IF s_id IS NOT NULL THEN
                UPDATE public.users SET status = 'Ready to Match' WHERE id = s_id;
            END IF;
        END IF;
    END IF;

    -- Dual acceptance -> 'Accepted' (NOT Active). Journey begins only after the
    -- admin completes the checklist and activates.
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

    -- On entering Active (admin activation), auto-create the Journey.
    IF (NEW.status = 'Active' AND (OLD.status IS NULL OR OLD.status != 'Active')) THEN
        IF NOT EXISTS (SELECT 1 FROM public.journeys WHERE match_id = NEW.id) THEN
            case_no := 'CASE-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || SUBSTR(CAST(NEW.id AS TEXT), 1, 4);
            INSERT INTO public.journeys (
                match_id, parent_id, surrogate_id, case_manager_id,
                status, stage, case_number, created_at
            ) VALUES (
                NEW.id, p_id, s_id, NEW.coordinator_id,
                'Active', 'Medical Screening', case_no, NOW()
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

-- Presenting a match (insert) marks both users match-eligible.
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


-- ============================================================================
-- B. FIX DUPLICATE CONVERSATION PARTICIPANTS (one-way chat fix)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_conversation_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.conversations
       SET participants = (
         SELECT ARRAY(
           SELECT DISTINCT unnest(
             array_append(COALESCE(participants, ARRAY[]::uuid[]), NEW.user_id)
           )
         )
       )
     WHERE id = NEW.conversation_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.conversations
       SET participants = array_remove(participants, OLD.user_id)
     WHERE id = OLD.conversation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_participants ON public.conversation_participants;
CREATE TRIGGER tr_sync_participants
AFTER INSERT OR DELETE ON public.conversation_participants
FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_participants();

UPDATE public.conversations
   SET participants = (SELECT ARRAY(SELECT DISTINCT unnest(participants)))
 WHERE participants IS NOT NULL
   AND array_length(participants, 1) IS DISTINCT FROM
       (SELECT count(DISTINCT x) FROM unnest(participants) AS x);


-- ============================================================================
-- D. CONVERSATION NAME COLUMN (needed before backfill names groups)
-- ============================================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS name text;


-- ============================================================================
-- C. BACKFILL CHAT THREADS FOR EXISTING ACTIVE MATCHES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_conversation(p_ids uuid[])
RETURNS uuid AS $$
DECLARE
  ids      uuid[];
  existing uuid;
  new_id   uuid;
  names    jsonb;
  uid      uuid;
BEGIN
  SELECT array_agg(DISTINCT x ORDER BY x) INTO ids
    FROM unnest(p_ids) AS x WHERE x IS NOT NULL;
  IF ids IS NULL OR array_length(ids, 1) < 2 THEN
    RETURN NULL;
  END IF;

  SELECT c.id INTO existing
    FROM public.conversations c
   WHERE (SELECT array_agg(DISTINCT y ORDER BY y) FROM unnest(c.participants) AS y) = ids
   LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  SELECT jsonb_object_agg(
           u.id::text,
           COALESCE(NULLIF(trim(u.full_name), ''),
                    NULLIF(trim(coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')), ''),
                    'Member')
         ) INTO names
    FROM public.users u WHERE u.id = ANY(ids);

  INSERT INTO public.conversations
    (participants, participant_names, last_message, last_message_at, last_message_time, created_at)
  VALUES
    (ids, COALESCE(names, '{}'::jsonb), 'New conversation started', now(), now(), now())
  RETURNING id INTO new_id;

  FOREACH uid IN ARRAY ids LOOP
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (new_id, uid,
      (SELECT CASE WHEN u.role = 'Admin' THEN 'admin' ELSE 'user' END
         FROM public.users u WHERE u.id = uid));
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
  admin_id uuid;
  m        record;
BEGIN
  SELECT id INTO admin_id FROM public.users WHERE role = 'Admin'
   ORDER BY created_at NULLS LAST LIMIT 1;

  FOR m IN
    SELECT intended_parent_id AS p, gestational_carrier_id AS s
      FROM public.matches
     WHERE status = 'Active'
       AND intended_parent_id IS NOT NULL
       AND gestational_carrier_id IS NOT NULL
  LOOP
    PERFORM public.ensure_conversation(ARRAY[m.p, m.s]);
    IF admin_id IS NOT NULL THEN
      PERFORM public.ensure_conversation(ARRAY[m.p, m.s, admin_id]);
      PERFORM public.ensure_conversation(ARRAY[m.p, admin_id]);
      PERFORM public.ensure_conversation(ARRAY[m.s, admin_id]);
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.ensure_conversation(uuid[]);


-- ============================================================================
-- D. NAME EXISTING "CARE TEAM" GROUPS
-- ============================================================================
UPDATE public.conversations c
   SET name = 'Care Team — ' || COALESCE((
         SELECT string_agg(
                  COALESCE(NULLIF(trim(u.first_name), ''),
                           NULLIF(trim(u.full_name), ''),
                           'Member'),
                  ' & ' ORDER BY u.first_name)
           FROM (SELECT DISTINCT unnest(c.participants) AS pid) pp
           JOIN public.users u ON u.id = pp.pid
          WHERE u.role IS DISTINCT FROM 'Admin'
       ), 'Family')
 WHERE c.name IS NULL
   AND (SELECT count(DISTINCT x) FROM unnest(c.participants) AS x) >= 3
   AND EXISTS (
         SELECT 1 FROM (SELECT DISTINCT unnest(c.participants) AS pid) q
           JOIN public.users u ON u.id = q.pid WHERE u.role = 'Admin'
       );
