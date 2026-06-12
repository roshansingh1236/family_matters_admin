-- ============================================================================
-- Backfill chat threads for already-active matches (2026-06-11)
--
-- ensureSupportThreads() (app) only provisions the surrogate<->parent and group
-- (surrogate+parent+admin) threads when a user opens the chat screen. Matches
-- that were already Active (journey created) before that shipped have no such
-- threads. This migration creates them for every existing Active match, plus
-- the admin<->user threads. Idempotent: existing threads are reused, never
-- duplicated.
-- ============================================================================

-- Helper: ensure a conversation exists for an exact participant SET. Returns
-- the existing or newly created conversation id. Compares participants as a
-- DISTINCT sorted set so duplicate-padded arrays don't spawn parallels.
CREATE OR REPLACE FUNCTION public.ensure_conversation(p_ids uuid[])
RETURNS uuid AS $$
DECLARE
  ids        uuid[];
  existing   uuid;
  new_id     uuid;
  names      jsonb;
  uid        uuid;
BEGIN
  SELECT array_agg(DISTINCT x ORDER BY x)
    INTO ids
    FROM unnest(p_ids) AS x
   WHERE x IS NOT NULL;

  IF ids IS NULL OR array_length(ids, 1) < 2 THEN
    RETURN NULL;
  END IF;

  -- Existing conversation with the same DISTINCT participant set?
  SELECT c.id
    INTO existing
    FROM public.conversations c
   WHERE (SELECT array_agg(DISTINCT y ORDER BY y) FROM unnest(c.participants) AS y) = ids
   LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  SELECT jsonb_object_agg(
           u.id::text,
           COALESCE(
             NULLIF(trim(u.full_name), ''),
             NULLIF(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
             'Member'
           )
         )
    INTO names
    FROM public.users u
   WHERE u.id = ANY(ids);

  INSERT INTO public.conversations
    (participants, participant_names, last_message, last_message_at, last_message_time, created_at)
  VALUES
    (ids, COALESCE(names, '{}'::jsonb), 'New conversation started', now(), now(), now())
  RETURNING id INTO new_id;

  FOREACH uid IN ARRAY ids LOOP
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (
      new_id,
      uid,
      (SELECT CASE WHEN u.role = 'Admin' THEN 'admin' ELSE 'user' END
         FROM public.users u WHERE u.id = uid)
    );
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill -------------------------------------------------------------------
DO $$
DECLARE
  admin_id uuid;
  m        record;
BEGIN
  SELECT id INTO admin_id
    FROM public.users
   WHERE role = 'Admin'
   ORDER BY created_at NULLS LAST
   LIMIT 1;

  FOR m IN
    SELECT intended_parent_id AS p, gestational_carrier_id AS s
      FROM public.matches
     WHERE status = 'Active'
       AND intended_parent_id IS NOT NULL
       AND gestational_carrier_id IS NOT NULL
  LOOP
    -- Surrogate <-> Parent
    PERFORM public.ensure_conversation(ARRAY[m.p, m.s]);

    IF admin_id IS NOT NULL THEN
      -- Group: Surrogate + Parent + Admin
      PERFORM public.ensure_conversation(ARRAY[m.p, m.s, admin_id]);
      -- Admin <-> each user
      PERFORM public.ensure_conversation(ARRAY[m.p, admin_id]);
      PERFORM public.ensure_conversation(ARRAY[m.s, admin_id]);
    END IF;
  END LOOP;
END $$;

-- Clean up the helper (ongoing provisioning is handled by the app).
DROP FUNCTION IF EXISTS public.ensure_conversation(uuid[]);
