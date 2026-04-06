-- COMPREHENSIVE FIX: TRIGGER RECURSION, SCHEMA EXPANSION (user seeding removed; see scripts/seed-users.cjs)

-- 1. ENSURE ALL COLUMNS MENTIONED IN DATA DUMP EXIST IN public.users
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    -- Core & Profile Status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_completed') THEN
        ALTER TABLE public.users ADD COLUMN "profile_completed" BOOLEAN DEFAULT false;
    END IF;
END $$;
