-- migration file: 20260616_fix_matches_realtime_and_rls.sql
DO $$
BEGIN
    -- 1. Enable realtime for matches
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'matches') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
    END IF;

    -- 2. Add UPDATE policy for matches
    DROP POLICY IF EXISTS "matches_update" ON public.matches;
    CREATE POLICY "matches_update" ON public.matches FOR UPDATE 
    USING (auth.uid() = intended_parent_id OR auth.uid() = gestational_carrier_id OR public.check_is_admin());
END $$;
