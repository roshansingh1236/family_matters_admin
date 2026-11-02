-- ============================================================================
-- FIX MESSAGING RLS & REALTIME + FLUTTER APP COMPATIBILITY (Resilient version)
-- Fixes uuid vs text operator mismatch.
-- ============================================================================

-- ─── SCHEMA HARMONIZATION ──────────────────────────────────────────────────

-- 1. Update conversations table with explicit casts
DO $$
BEGIN
    -- Ensure participants column exists as uuid[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'participants'
    ) THEN
        -- If it exists as text[], convert it to uuid[]
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'conversations' AND column_name = 'participants' AND data_type = 'ARRAY' AND udt_name = '_text'
        ) THEN
            ALTER TABLE public.conversations ALTER COLUMN participants TYPE uuid[] USING participants::uuid[];
        END IF;
    ELSE
        ALTER TABLE public.conversations ADD COLUMN participants uuid[];
    END IF;
END $$;

ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS participant_names jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_message_time timestamptz DEFAULT now();

-- 2. Update messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS "text" text,
  ADD COLUMN IF NOT EXISTS "timestamp" timestamptz DEFAULT now();

-- Set values for new columns if they are empty
UPDATE public.messages SET "text" = content WHERE "text" IS NULL;
UPDATE public.messages SET "timestamp" = created_at WHERE "timestamp" IS NULL;
UPDATE public.conversations SET last_message_time = last_message_at WHERE last_message_time IS NULL;

-- ─── REALTIME ENABLEMENT ─────────────────────────────────────────────────────

-- Add tables to supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Efficient way to add tables (silently ignore if already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- Set replica identity to FULL to ensure the app gets all data in realtime events
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ─── RLS POLICIES ─────────────────────────────────────────────────────────────

-- Conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_admin_all" ON public.conversations;
CREATE POLICY "conversations_admin_all" ON public.conversations 
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "conversations_view_all" ON public.conversations;
CREATE POLICY "conversations_view_all" ON public.conversations FOR SELECT
  USING (
    public.check_is_admin() 
    OR (participants IS NOT NULL AND auth.uid() = ANY(participants))
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

-- Participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_admin_all" ON public.conversation_participants;
CREATE POLICY "participants_admin_all" ON public.conversation_participants 
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "participants_view_self" ON public.conversation_participants;
CREATE POLICY "participants_view_self" ON public.conversation_participants 
  FOR SELECT USING (auth.uid() = user_id OR public.check_is_admin());

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
CREATE POLICY "messages_admin_all" ON public.messages 
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "messages_view_all" ON public.messages;
CREATE POLICY "messages_view_all" ON public.messages FOR SELECT
  USING (
    public.check_is_admin() 
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND auth.uid() = ANY(c.participants)
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND (
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id AND auth.uid() = ANY(c.participants)
      )
    )
  );

-- ─── SYNC TRIGGER ────────────────────────────────────────────────────────────

-- Trigger to keep conversations.participants in sync with conversation_participants table
CREATE OR REPLACE FUNCTION public.sync_conversation_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.conversations 
    SET participants = array_append(COALESCE(participants, ARRAY[]::uuid[]), NEW.user_id)
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
