-- =============================================================================
-- Migration: Cleanup Roshan Test Users
-- Description: Completely deletes specific test users and all their associated 
-- data from the database (auth and public schemas).
-- Target Emails: 
--   1. roshanpratap1235@gmail.com
--   2. roshansingh1235@gmail.com
-- =============================================================================

DO $$
DECLARE
  ids uuid[];
  jids uuid[];
BEGIN
  -- 1. Identify the user IDs from auth.users
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO ids
  FROM auth.users
  WHERE lower(trim(email)) = ANY (ARRAY[
    lower(trim('roshanpratap1235@gmail.com')),
    lower(trim('roshansingh1235@gmail.com'))
  ]);

  IF ids IS NULL OR coalesce(array_length(ids, 1), 0) = 0 THEN
    RAISE NOTICE 'No auth users matched the target emails; nothing to delete.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % matching user(s). Starting deep cleanup...', array_length(ids, 1);

  -- 2. Identify all Journey IDs associated with these users
  SELECT coalesce(array_agg(DISTINCT j.id), ARRAY[]::uuid[])
  INTO jids
  FROM public.journeys j
  LEFT JOIN public.matches m ON m.id = j.match_id
  WHERE j.parent_id = ANY (ids)
     OR j.surrogate_id = ANY (ids)
     OR j.case_manager_id = ANY (ids)
     OR m.intended_parent_id = ANY (ids)
     OR m.gestational_carrier_id = ANY (ids)
     OR m.coordinator_id = ANY (ids);

  -- 3. Cleanup direct user-linked data (public schema)
  DELETE FROM public.messages WHERE sender_id = ANY (ids);
  DELETE FROM public.conversation_participants WHERE user_id = ANY (ids);
  DELETE FROM public.tasks WHERE user_id = ANY (ids) OR created_by = ANY (ids);
  DELETE FROM public.payments WHERE surrogate_id = ANY (ids) OR parent_id = ANY (ids);
  DELETE FROM public.appointments WHERE user_id = ANY (ids);
  DELETE FROM public.documents WHERE user_id = ANY (ids);
  DELETE FROM public.medications WHERE surrogate_id = ANY (ids) OR user_id = ANY (ids);
  DELETE FROM public.medical_records WHERE surrogate_id = ANY (ids) OR user_id = ANY (ids);
  DELETE FROM public.medical_screening WHERE surrogate_id = ANY (ids) OR reviewed_by = ANY (ids);
  DELETE FROM public.agency_financials WHERE created_by = ANY (ids);
  DELETE FROM public.baby_watch_updates WHERE author_id = ANY (ids);
  
  -- Cleanup audit logs (optional, but requested "whole database")
  DELETE FROM public.audit_log WHERE actor_id = ANY (ids);
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contracts') THEN
    DELETE FROM public.contracts WHERE surrogate_id = ANY (ids) OR parent_id = ANY (ids);
  END IF;

  -- 4. Cleanup journey-linked data (before deleting journeys)
  IF coalesce(array_length(jids, 1), 0) > 0 THEN
    RAISE NOTICE 'Found % associated journey(s). Cleaning up journey data...', array_length(jids, 1);
    
    -- Clear FK on matches to avoid circular dependency issues
    UPDATE public.matches SET journey_id = NULL WHERE journey_id = ANY (jids);

    DELETE FROM public.agency_financials WHERE journey_id = ANY (jids);
    DELETE FROM public.baby_watch_updates WHERE journey_id = ANY (jids);
    DELETE FROM public.appointments WHERE journey_id = ANY (jids);
    DELETE FROM public.payments WHERE journey_id = ANY (jids);
    DELETE FROM public.tasks WHERE journey_id = ANY (jids);
    DELETE FROM public.documents WHERE journey_id = ANY (jids);

    -- Delete journey conversations and messages
    DELETE FROM public.messages
    WHERE conversation_id IN (SELECT id FROM public.conversations WHERE journey_id = ANY (jids));

    DELETE FROM public.conversation_participants
    WHERE conversation_id IN (SELECT id FROM public.conversations WHERE journey_id = ANY (jids));

    DELETE FROM public.conversations WHERE journey_id = ANY (jids);

    -- Finally delete the journeys
    DELETE FROM public.journeys WHERE id = ANY (jids);
  END IF;

  -- 5. Delete remaining matches where these users were participants
  DELETE FROM public.matches
  WHERE intended_parent_id = ANY (ids)
     OR gestational_carrier_id = ANY (ids)
     OR coordinator_id = ANY (ids);

  -- 6. Delete from public.users profile table
  DELETE FROM public.users WHERE id = ANY (ids);

  -- 7. Cleanup Auth schema (identities, sessions, tokens, and finally users)
  DELETE FROM auth.identities WHERE user_id = ANY (ids);
  DELETE FROM auth.sessions WHERE user_id = ANY (ids);
  
  -- Use string comparison/cast for refresh_tokens if necessary (Supabase structure)
  DELETE FROM auth.refresh_tokens WHERE user_id::text = ANY (ids::text[]);

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'mfa_factors') THEN
    DELETE FROM auth.mfa_factors WHERE user_id = ANY (ids);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'one_time_tokens') THEN
    DELETE FROM auth.one_time_tokens WHERE user_id = ANY (ids);
  END IF;

  -- The final step: delete from auth.users
  DELETE FROM auth.users WHERE id = ANY (ids);

  RAISE NOTICE 'SUCCESS: Completely deleted % user(s) and all related records.', array_length(ids, 1);
  RAISE NOTICE 'NOTE: Files in storage buckets must be deleted via the Storage API or Supabase Dashboard.';
END $$;
