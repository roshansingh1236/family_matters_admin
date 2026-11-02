-- Unblock "User already registered" / "already exists" for roshanpratap1235@gmail.com when the user
-- does not appear under Authentication > Users. Typical causes:
--   (1) Another row has this address in email_change (pending email change).
--   (2) A row exists in auth.users with different whitespace/casing (dashboard search can miss it).
--   (3) Orphan auth.identities for that email.
--
-- Run once in Supabase SQL Editor. Then create the user again from the dashboard or API.

DO $$
DECLARE
  target constant text := lower(trim('roshanpratap1235@gmail.com'));
  ids uuid[];
  jids uuid[];
BEGIN
  -- (1) Another account may be "holding" this address as a pending email_change — clear it (no row to delete).
  UPDATE auth.users
  SET
    email_change = NULL,
    email_change_token_new = ''
  WHERE lower(trim(coalesce(email_change, ''))) = target;

  -- (2) Rows to remove: primary email matches, or identity email matches (do not use email_change here).
  SELECT coalesce(array_agg(DISTINCT x.id), ARRAY[]::uuid[])
  INTO ids
  FROM (
    SELECT u.id
    FROM auth.users u
    WHERE lower(trim(coalesce(u.email, ''))) = target
    UNION
    SELECT i.user_id
    FROM auth.identities i
    WHERE i.user_id IS NOT NULL
      AND lower(trim(coalesce(i.identity_data->>'email', ''))) = target
  ) AS x;

  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RAISE NOTICE 'No auth.users/identities row for %; email_change reservations cleared if any.', target;
    RETURN;
  END IF;

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

  IF coalesce(array_length(jids, 1), 0) > 0 THEN
    UPDATE public.matches SET journey_id = NULL WHERE journey_id = ANY (jids);
    DELETE FROM public.agency_financials WHERE journey_id = ANY (jids);
    DELETE FROM public.baby_watch_updates WHERE journey_id = ANY (jids);
    DELETE FROM public.appointments WHERE journey_id = ANY (jids);
    DELETE FROM public.payments WHERE journey_id = ANY (jids);
    DELETE FROM public.tasks WHERE journey_id = ANY (jids);
    DELETE FROM public.documents WHERE journey_id = ANY (jids);
    DELETE FROM public.messages
    WHERE conversation_id IN (SELECT id FROM public.conversations WHERE journey_id = ANY (jids));
    DELETE FROM public.conversation_participants
    WHERE conversation_id IN (SELECT id FROM public.conversations WHERE journey_id = ANY (jids));
    DELETE FROM public.conversations WHERE journey_id = ANY (jids);
    DELETE FROM public.journeys WHERE id = ANY (jids);
  END IF;

  DELETE FROM public.matches
  WHERE intended_parent_id = ANY (ids)
     OR gestational_carrier_id = ANY (ids)
     OR coordinator_id = ANY (ids);

  DELETE FROM public.users WHERE id = ANY (ids);

  DELETE FROM auth.identities WHERE user_id = ANY (ids);
  DELETE FROM auth.sessions WHERE user_id = ANY (ids);
  DELETE FROM auth.refresh_tokens WHERE user_id::uuid = ANY (ids);

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'mfa_factors'
  ) THEN
    DELETE FROM auth.mfa_factors WHERE user_id = ANY (ids);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'one_time_tokens'
  ) THEN
    DELETE FROM auth.one_time_tokens WHERE user_id = ANY (ids);
  END IF;

  DELETE FROM auth.users WHERE id = ANY (ids);

  RAISE NOTICE 'Removed auth + related rows for roshanpratap1235@gmail.com (% id(s)).', coalesce(array_length(ids, 1), 0);
END $$;
