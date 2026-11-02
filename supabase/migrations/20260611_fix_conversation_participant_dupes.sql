-- ============================================================================
-- Fix one-way / split chats caused by duplicated conversation participants
-- (2026-06-11)
--
-- Root cause: createConversation (admin portal) and getOrCreate* (app) insert
-- the conversation row with `participants` already populated, AND insert rows
-- into conversation_participants. The sync trigger then array_append-ed each
-- participant again, producing arrays like {admin,user,admin,user}. Dedup logic
-- that compared array length then failed to recognize the existing thread and
-- created a PARALLEL conversation — so one side's messages landed in a
-- different row, reading as a one-way chat.
--
-- This migration:
--   1. Makes the sync trigger idempotent (DISTINCT, never duplicates).
--   2. De-duplicates existing `participants` arrays.
-- Idempotent and safe to re-run.
-- ============================================================================

-- 1. Idempotent sync trigger ------------------------------------------------
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

-- 2. De-duplicate existing participants arrays ------------------------------
UPDATE public.conversations
   SET participants = (
     SELECT ARRAY(SELECT DISTINCT unnest(participants))
   )
 WHERE participants IS NOT NULL
   AND array_length(participants, 1) IS DISTINCT FROM
       (SELECT count(DISTINCT x) FROM unnest(participants) AS x);

-- NOTE: if the buggy dedup already created PARALLEL conversation rows for the
-- same pair during testing, those separate rows are not auto-merged here (to
-- avoid risky message migration). Identify them with the query below and merge
-- or delete the empty extras manually if needed:
--
--   SELECT participants, count(*)
--     FROM public.conversations
--    GROUP BY participants
--   HAVING count(*) > 1;
