-- SUPABASE RE-MIGRATION SCRIPT (FIXING RECURSION, SCHEMA MISMATCHES & MISSING COLUMNS - VERSION 7)
-- Project: Surrogacy App

-- 1. ENSURE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. DISABLE RLS TEMPORARILY
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL POTENTIALLY RECURSIVE POLICIES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
    DROP POLICY IF EXISTS "Agency staff can view all users" ON public.users;
    DROP POLICY IF EXISTS "Service role access" ON public.users;
    DROP POLICY IF EXISTS "Admins have full access" ON public.users;
    DROP POLICY IF EXISTS "Individuals can view their own user data" ON public.users;
    DROP POLICY IF EXISTS "admin_view_all" ON public.users;
    DROP POLICY IF EXISTS "user_view_self" ON public.users;
    DROP POLICY IF EXISTS "user_update_self" ON public.users;
    DROP POLICY IF EXISTS "admin_all_access" ON public.users;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 3. ENSURE COLUMNS EXIST
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name') THEN
            ALTER TABLE public.users ADD COLUMN full_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role') THEN
            ALTER TABLE public.users ADD COLUMN role TEXT;
        END IF;
    END IF;
END $$;

-- 4. CREATE/UPDATE BYPASS FUNCTION
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND (role = 'agencyStaff' OR role = 'Agency Staff' OR role = 'Admin' OR LOWER(role) = 'admin')
  );
EXCEPTION
    WHEN undefined_table THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. USER SYNC TRIGGER (Sync Auth.Users metadata to Public.Users)
-- This ensures that when a user signs up or updates their metadata, it reflects in public.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
    raw_role TEXT;
    final_role TEXT;
BEGIN
    raw_role := COALESCE(new.raw_user_meta_data->>'role', 'Admin');
    
    -- Map roles to allowed check constraint values ('Intended Parent', 'Surrogate', 'Agency Staff', 'Admin')
    CASE 
        WHEN LOWER(raw_role) IN ('admin', 'administrator') THEN
            final_role := 'Admin';
        WHEN LOWER(raw_role) IN ('agency staff', 'agencystaff', 'agency_staff', 'staff') THEN
            final_role := 'Agency Staff';
        WHEN LOWER(raw_role) IN ('intended parent', 'intendedparent', 'parent', 'ip') THEN
            final_role := 'Intended Parent';
        WHEN LOWER(raw_role) IN ('surrogate', 'gestational carrier', 'gestationalcarrier', 'gc') THEN
            final_role := 'Surrogate';
        ELSE
            final_role := 'Admin'; -- Default fallback
    END CASE;

  INSERT INTO public.users (id, email, first_name, last_name, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    split_part(new.raw_user_meta_data->>'full_name', ' ', 1),
    substring(new.raw_user_meta_data->>'full_name' from position(' ' in new.raw_user_meta_data->>'full_name') + 1),
    new.raw_user_meta_data->>'full_name',
    final_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RE-ENABLE RLS & CREATE CLEAN POLICIES
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "user_view_self" ON public.users;
        CREATE POLICY "user_view_self" ON public.users FOR SELECT USING (auth.uid() = id);
        DROP POLICY IF EXISTS "admin_view_all" ON public.users;
        CREATE POLICY "admin_view_all" ON public.users FOR SELECT USING (public.check_is_admin());
        DROP POLICY IF EXISTS "user_update_self" ON public.users;
        CREATE POLICY "user_update_self" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
        DROP POLICY IF EXISTS "admin_all_access" ON public.users;
        CREATE POLICY "admin_all_access" ON public.users FOR ALL USING (public.check_is_admin());
    END IF;
END $$;

-- 7. HARMONIZE OTHER TABLES
-- Matches
DO $$ BEGIN
    -- Ensure table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'matches') THEN
        CREATE TABLE public.matches (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            intended_parent_id uuid REFERENCES public.users(id) NOT NULL,
            gestational_carrier_id uuid REFERENCES public.users(id),
            status text NOT NULL CHECK (status IN ('Proposed', 'Presented', 'Accepted', 'Active', 'Dissolved', 'Declined')),
            match_score numeric,
            match_criteria jsonb DEFAULT '{}'::jsonb,
            agency_notes text,
            matched_at timestamp with time zone,
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'matches') THEN
        ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "matches_view_all" ON public.matches;
        CREATE POLICY "matches_view_all" ON public.matches FOR SELECT 
        USING (auth.uid() = intended_parent_id OR auth.uid() = gestational_carrier_id OR public.check_is_admin());
    END IF;
END $$;

-- Journeys
DO $$ BEGIN
    -- Ensure table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journeys') THEN
        CREATE TABLE public.journeys (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            match_id uuid REFERENCES public.matches(id) NOT NULL,
            case_number text UNIQUE NOT NULL,
            status text NOT NULL,
            parent_id uuid REFERENCES public.users(id),
            surrogate_id uuid REFERENCES public.users(id),
            estimated_delivery_date date,
            journey_notes jsonb DEFAULT '{}'::jsonb,
            created_at timestamp with time zone DEFAULT now(),
            completed_at timestamp with time zone
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journeys') THEN
        ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
        
        -- Add parent_id/surrogate_id if they are missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journeys' AND column_name = 'parent_id') THEN
            -- Check if it exists as intended_parent_id first
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journeys' AND column_name = 'intended_parent_id') THEN
                ALTER TABLE public.journeys RENAME COLUMN intended_parent_id TO parent_id;
            ELSE
                ALTER TABLE public.journeys ADD COLUMN parent_id UUID REFERENCES public.users(id);
            END IF;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journeys' AND column_name = 'surrogate_id') THEN
            -- Check if it exists as gestational_carrier_id first
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journeys' AND column_name = 'gestational_carrier_id') THEN
                ALTER TABLE public.journeys RENAME COLUMN gestational_carrier_id TO surrogate_id;
            ELSE
                ALTER TABLE public.journeys ADD COLUMN surrogate_id UUID REFERENCES public.users(id);
            END IF;
        END IF;

        DROP POLICY IF EXISTS "journeys_view_all" ON public.journeys;
        CREATE POLICY "journeys_view_all" ON public.journeys FOR SELECT 
        USING (auth.uid() = parent_id OR auth.uid() = surrogate_id OR public.check_is_admin());
    END IF;
END $$;

-- Tasks
DO $$ BEGIN
    -- Ensure table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN
        CREATE TABLE public.tasks (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id uuid REFERENCES public.users(id), -- Assigned to
            journey_id uuid REFERENCES public.journeys(id),
            title text NOT NULL,
            description text,
            due_date date,
            priority text CHECK (priority IN ('Low', 'Medium', 'High')),
            status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
            created_by uuid REFERENCES public.users(id),
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN
        ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "tasks_view_all" ON public.tasks;
        CREATE POLICY "tasks_view_all" ON public.tasks FOR SELECT 
        USING (auth.uid() = user_id OR public.check_is_admin());
    END IF;
END $$;

-- Appointments
DO $$ BEGIN
    -- Ensure table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointments') THEN
        CREATE TABLE public.appointments (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            journey_id uuid REFERENCES public.journeys(id),
            user_id uuid REFERENCES public.users(id),
            title text NOT NULL,
            description text,
            date timestamp with time zone NOT NULL,
            location text,
            type text,
            status text DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    -- Update policies
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointments') THEN
        ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "appointments_view_all" ON public.appointments;
        CREATE POLICY "appointments_view_all" ON public.appointments FOR SELECT 
        USING (auth.uid() = user_id OR public.check_is_admin());
    END IF;
END $$;

-- Baby Watch Updates
DO $$ BEGIN
    -- Rename if old table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'baby_watch') AND 
       NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'baby_watch_updates') THEN
        ALTER TABLE public.baby_watch RENAME TO baby_watch_updates;
        -- Rename column if needed (based on migrate.js structure)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='baby_watch_updates' AND column_name='case_id') THEN
            ALTER TABLE public.baby_watch_updates RENAME COLUMN case_id TO journey_id;
        END IF;
    END IF;

    -- Ensure table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'baby_watch_updates') THEN
        CREATE TABLE public.baby_watch_updates (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            journey_id uuid REFERENCES public.journeys(id) NOT NULL,
            title text NOT NULL,
            description text,
            update_type text CHECK (update_type IN ('Ultrasound', 'Growth', 'Milestone', 'Other')),
            data jsonb DEFAULT '{}'::jsonb, 
            attachments text[],
            shared_with_parents boolean DEFAULT true,
            author_id uuid REFERENCES public.users(id),
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    -- Ensure column exists if table was renamed or already existed
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'baby_watch_updates') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='baby_watch_updates' AND column_name='shared_with_parents') THEN
            ALTER TABLE public.baby_watch_updates ADD COLUMN shared_with_parents boolean DEFAULT true;
        END IF;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'baby_watch_updates') THEN
        ALTER TABLE public.baby_watch_updates ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "updates_view_all" ON public.baby_watch_updates;
        CREATE POLICY "updates_view_all" ON public.baby_watch_updates FOR SELECT 
        USING (public.check_is_admin() OR EXISTS (
            SELECT 1 FROM public.journeys j 
            WHERE j.id = journey_id 
            AND (j.parent_id = auth.uid() OR j.surrogate_id = auth.uid())
        ));
        
        DROP POLICY IF EXISTS "admin_all_baby_watch" ON public.baby_watch_updates;
        CREATE POLICY "admin_all_baby_watch" ON public.baby_watch_updates FOR ALL 
        USING (public.check_is_admin());
    END IF;
END $$;

-- Messaging Module
DO $$ BEGIN
    -- Conversations
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        CREATE TABLE public.conversations (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            journey_id uuid REFERENCES public.journeys(id),
            title text, -- Null if 1:1 chat
            last_message text,
            last_message_at timestamp with time zone DEFAULT now(),
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    -- Conversation Participants
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_participants') THEN
        CREATE TABLE public.conversation_participants (
            conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
            user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
            role text, -- 'admin', 'parent', 'surrogate'
            joined_at timestamp with time zone DEFAULT now(),
            unread_count int DEFAULT 0,
            PRIMARY KEY (conversation_id, user_id)
        );
    END IF;

    -- Messages
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        CREATE TABLE public.messages (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
            sender_id uuid REFERENCES public.users(id) NOT NULL,
            content text NOT NULL,
            attachments text[],
            is_read boolean DEFAULT false,
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    -- Apply Policies
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "conversations_view_all" ON public.conversations;
        CREATE POLICY "conversations_view_all" ON public.conversations FOR SELECT 
        USING (public.check_is_admin() OR EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
        ));
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "messages_view_all" ON public.messages;
        CREATE POLICY "messages_view_all" ON public.messages FOR SELECT 
        USING (public.check_is_admin() OR EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
        ));
    END IF;
END $$;

-- 8. REMAINING CORE TABLES
-- Medical Screening
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medical_screening') THEN
        CREATE TABLE public.medical_screening (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            surrogate_id uuid REFERENCES public.users(id) NOT NULL,
            status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Review', 'Cleared', 'Rejected')),
            medical_history jsonb NOT NULL,
            internal_notes text,
            submitted_at timestamp with time zone DEFAULT now(),
            reviewed_at timestamp with time zone,
            reviewed_by uuid REFERENCES public.users(id)
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medical_screening') THEN
        ALTER TABLE public.medical_screening ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "screening_admin_all" ON public.medical_screening;
        CREATE POLICY "screening_admin_all" ON public.medical_screening FOR ALL USING (public.check_is_admin());
        DROP POLICY IF EXISTS "screening_view_own" ON public.medical_screening;
        CREATE POLICY "screening_view_own" ON public.medical_screening FOR SELECT USING (auth.uid() = surrogate_id);
    END IF;
END $$;

-- Medical Records
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medical_records') THEN
        CREATE TABLE public.medical_records (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            surrogate_id uuid REFERENCES public.users(id),
            user_id uuid REFERENCES public.users(id),
            patient_name text NOT NULL,
            date date NOT NULL,
            type text NOT NULL,
            title text NOT NULL,
            summary text,
            provider text,
            doctor text,
            facility text,
            status text CHECK (status IN ('Verified', 'Pending', 'Flagged')),
            shared_with_parents boolean DEFAULT false,
            attachments text[],
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medical_records') THEN
        ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "records_admin_all" ON public.medical_records;
        CREATE POLICY "records_admin_all" ON public.medical_records FOR ALL USING (public.check_is_admin());
        DROP POLICY IF EXISTS "records_view_own" ON public.medical_records;
        CREATE POLICY "records_view_own" ON public.medical_records FOR SELECT USING (auth.uid() = surrogate_id OR auth.uid() = user_id);
    END IF;
END $$;

-- Medications
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medications') THEN
        CREATE TABLE public.medications (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            surrogate_id uuid REFERENCES public.users(id),
            user_id uuid REFERENCES public.users(id),
            name text NOT NULL,
            dosage text,
            frequency text,
            start_date date NOT NULL,
            end_date date,
            status text CHECK (status IN ('Active', 'Completed', 'Discontinued')),
            notes text,
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medications') THEN
        ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "medications_admin_all" ON public.medications;
        CREATE POLICY "medications_admin_all" ON public.medications FOR ALL USING (public.check_is_admin());
        DROP POLICY IF EXISTS "medications_view_own" ON public.medications;
        CREATE POLICY "medications_view_own" ON public.medications FOR SELECT USING (auth.uid() = surrogate_id OR auth.uid() = user_id);
    END IF;
END $$;

-- Documents
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        CREATE TABLE public.documents (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id uuid REFERENCES public.users(id),
            journey_id uuid REFERENCES public.journeys(id),
            name text NOT NULL,
            url text NOT NULL,
            type text,
            status text DEFAULT 'pending',
            uploaded_at timestamp with time zone DEFAULT now()
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "documents_admin_all" ON public.documents;
        CREATE POLICY "documents_admin_all" ON public.documents FOR ALL USING (public.check_is_admin());
        DROP POLICY IF EXISTS "documents_view_own" ON public.documents;
        CREATE POLICY "documents_view_own" ON public.documents FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Payments
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
        CREATE TABLE public.payments (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            journey_id uuid REFERENCES public.journeys(id),
            surrogate_id uuid REFERENCES public.users(id),
            parent_id uuid REFERENCES public.users(id),
            amount decimal(12,2) NOT NULL,
            type text CHECK (type IN ('Base Compensation', 'Allowance', 'Medical', 'Travel', 'Clothing', 'Legal', 'Other')),
            category text CHECK (category IN ('Withdrawn', 'Received')),
            status text CHECK (status IN ('Paid', 'Pending', 'Scheduled', 'Overdue', 'Cancelled', 'Rejected')),
            due_date date NOT NULL,
            paid_date date,
            description text,
            reference_number text,
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
        ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
        CREATE POLICY "payments_admin_all" ON public.payments FOR ALL USING (public.check_is_admin());
        DROP POLICY IF EXISTS "payments_view_own" ON public.payments;
        CREATE POLICY "payments_view_own" ON public.payments FOR SELECT USING (auth.uid() = surrogate_id OR auth.uid() = parent_id);
    END IF;
END $$;

-- Agency Financials
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agency_financials') THEN
        CREATE TABLE public.agency_financials (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            journey_id uuid REFERENCES public.journeys(id),
            amount numeric NOT NULL,
            type text NOT NULL CHECK (type IN ('Revenue', 'Expense')),
            category text NOT NULL,
            description text,
            status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
            date timestamp with time zone DEFAULT now(),
            created_by uuid REFERENCES public.users(id),
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agency_financials') THEN
        ALTER TABLE public.agency_financials ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "financials_admin_only" ON public.agency_financials;
        CREATE POLICY "financials_admin_only" ON public.agency_financials FOR ALL USING (public.check_is_admin());
    END IF;
END $$;
