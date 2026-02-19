-- ENABLE REALTIME FOR USERS TABLE
-- This ensures that changes to the 'users' table are broadcast to subscribed clients.

-- 1. Create the publication if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add the users table to the publication
-- Note: 'ALTER PUBLICATION ... ADD TABLE' might fail if table is already in a publication.
-- We use a safe way to add it.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
END $$;

-- 3. Set replica identity to full to ensure we get all data in the real-time payload
ALTER TABLE public.users REPLICA IDENTITY FULL;
