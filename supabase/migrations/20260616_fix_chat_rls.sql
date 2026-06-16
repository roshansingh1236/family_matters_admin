DO $$
BEGIN
    -- Allow users to create conversations if they are in the participants list
    DROP POLICY IF EXISTS "conversations_insert_auth" ON public.conversations;
    CREATE POLICY "conversations_insert_auth" ON public.conversations FOR INSERT
    WITH CHECK (auth.uid() = ANY(participants));

    -- Allow users to update conversations if they are in the participants list
    DROP POLICY IF EXISTS "conversations_update_auth" ON public.conversations;
    CREATE POLICY "conversations_update_auth" ON public.conversations FOR UPDATE
    USING (auth.uid() = ANY(participants));

    -- Allow users to add participants to a conversation if they are part of it
    DROP POLICY IF EXISTS "participants_insert_auth" ON public.conversation_participants;
    CREATE POLICY "participants_insert_auth" ON public.conversation_participants FOR INSERT
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants)
    ));

    -- Allow users to update participants if they are part of the conversation
    DROP POLICY IF EXISTS "participants_update_auth" ON public.conversation_participants;
    CREATE POLICY "participants_update_auth" ON public.conversation_participants FOR UPDATE
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants)
    ));
END $$;
