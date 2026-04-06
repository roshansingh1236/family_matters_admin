-- ============================================================================
-- FAMILY MATTERS — FULL SCHEMA (SINGLE-FILE, IDEMPOTENT)
-- Run this in Supabase SQL Editor or via: supabase db reset --linked
-- Safe to run on both fresh and existing databases.
-- ============================================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── RLS BYPASS FUNCTION ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND (role IN ('Admin', 'Agency Staff', 'agencyStaff'))
  );
EXCEPTION
  WHEN undefined_table THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                       uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email                    text UNIQUE,
  first_name               text,
  last_name                text,
  full_name                text,
  role                     text CHECK (role IN ('Intended Parent', 'Surrogate', 'Agency Staff', 'Admin')),
  status                   text,
  profile_image_url        text,
  preferences              jsonb DEFAULT '{}'::jsonb,
  eligibility_status       boolean DEFAULT false,
  medical_clearance_status text,
  form_data                jsonb DEFAULT '{}'::jsonb,
  medical_screening_status text DEFAULT 'Not Started',
  created_at               timestamp with time zone DEFAULT now() NOT NULL,
  updated_at               timestamp with time zone DEFAULT now() NOT NULL
);

-- Add any columns that may be missing on existing tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name                text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS form_data                jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS medical_screening_status text DEFAULT 'Not Started';

-- ─── MATCHES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id                     uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  intended_parent_id     uuid REFERENCES public.users(id) NOT NULL,
  gestational_carrier_id uuid REFERENCES public.users(id),
  status                 text NOT NULL CHECK (status IN (
                           'Proposed', 'Presented', 'Accepted', 'Active',
                           'Delivered', 'Escrow Closure', 'Completed', 'Cancelled'
                         )),
  match_score            numeric,
  match_criteria         jsonb DEFAULT '{}'::jsonb,
  agency_notes           text,
  internal_notes         text,
  matched_at             timestamp with time zone,
  parent_accepted        boolean DEFAULT false,
  surrogate_accepted     boolean DEFAULT false,
  parent_declined        boolean DEFAULT false,
  surrogate_declined     boolean DEFAULT false,
  delivery_date          date,
  escrow_closed_at       timestamp with time zone,
  cancellation_reason    text,
  coordinator_id         uuid REFERENCES public.users(id),
  journey_id             uuid,   -- FK added after journeys table exists (see below)
  updated_at             timestamp with time zone DEFAULT now(),
  created_at             timestamp with time zone DEFAULT now()
);

-- Add columns that may be missing on existing tables
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS internal_notes         text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS matched_at             timestamp with time zone;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS parent_accepted        boolean DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS surrogate_accepted     boolean DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS parent_declined        boolean DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS surrogate_declined     boolean DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS delivery_date          date;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS escrow_closed_at       timestamp with time zone;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cancellation_reason    text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS coordinator_id         uuid REFERENCES public.users(id);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS updated_at             timestamp with time zone DEFAULT now();

-- Widen status constraint to spec values (drop old, add new)
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check
  CHECK (status IN (
    'Proposed', 'Presented', 'Accepted', 'Active',
    'Delivered', 'Escrow Closure', 'Completed', 'Cancelled'
  ));

-- Migrate any legacy statuses
UPDATE public.matches SET status = 'Cancelled' WHERE status IN ('Dissolved', 'Declined');

-- ─── JOURNEYS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journeys (
  id                     uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id               uuid REFERENCES public.matches(id) NOT NULL,
  case_number            text UNIQUE NOT NULL,
  status                 text NOT NULL CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  stage                  text DEFAULT 'Medical Screening' CHECK (stage IN (
                           'Medical Screening', 'Legal', 'Embryo Transfer',
                           'Pregnancy', 'Birth', 'Postpartum'
                         )),
  parent_id              uuid REFERENCES public.users(id),
  surrogate_id           uuid REFERENCES public.users(id),
  case_manager_id        uuid REFERENCES public.users(id),
  estimated_delivery_date date,
  delivery_date          date,
  postpartum_notes       text,
  medical_records        jsonb DEFAULT '{}'::jsonb,
  legal_agreements       jsonb DEFAULT '{}'::jsonb,
  journey_notes          jsonb DEFAULT '{}'::jsonb,
  completed_at           timestamp with time zone,
  updated_at             timestamp with time zone DEFAULT now(),
  created_at             timestamp with time zone DEFAULT now()
);

-- Add columns that may be missing on existing tables
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS stage           text DEFAULT 'Medical Screening'
  CHECK (stage IN ('Medical Screening','Legal','Embryo Transfer','Pregnancy','Birth','Postpartum'));
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS parent_id       uuid REFERENCES public.users(id);
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS surrogate_id    uuid REFERENCES public.users(id);
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS case_manager_id uuid REFERENCES public.users(id);
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS delivery_date   date;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS medical_records jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS legal_agreements jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS updated_at      timestamp with time zone DEFAULT now();

-- postpartum_notes: must be TEXT (service sends plain strings, not JSON)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journeys'
      AND column_name = 'postpartum_notes' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.journeys ALTER COLUMN postpartum_notes TYPE TEXT USING postpartum_notes::text;
  END IF;
END $$;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS postpartum_notes text;

-- Fix status constraint (old schema used stage names as status values)
ALTER TABLE public.journeys DROP CONSTRAINT IF EXISTS journeys_status_check;
ALTER TABLE public.journeys ADD CONSTRAINT journeys_status_check
  CHECK (status IN ('Active', 'Completed', 'Cancelled'));

-- Migrate any journeys that used stage names as status
UPDATE public.journeys
  SET stage = status, status = 'Active'
  WHERE status IN ('Medical Screening','Legal','Embryo Transfer','Pregnancy','Birth');

-- Now add the journey_id FK on matches (safe now that journeys exists)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES public.journeys(id);

-- ─── REMAINING TABLES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_financials (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  journey_id  uuid REFERENCES public.journeys(id),
  amount      numeric NOT NULL,
  type        text NOT NULL CHECK (type IN ('Revenue', 'Expense')),
  category    text NOT NULL,
  description text,
  status      text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
  date        timestamp with time zone DEFAULT now(),
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_screening (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  surrogate_id   uuid REFERENCES public.users(id) NOT NULL,
  status         text DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Review', 'Cleared', 'Rejected')),
  medical_history jsonb NOT NULL,
  internal_notes text,
  submitted_at   timestamp with time zone DEFAULT now(),
  reviewed_at    timestamp with time zone,
  reviewed_by    uuid REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.medical_records (
  id                  uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  surrogate_id        uuid REFERENCES public.users(id),
  user_id             uuid REFERENCES public.users(id),
  patient_name        text NOT NULL,
  date                date NOT NULL,
  type                text NOT NULL,
  title               text NOT NULL,
  summary             text,
  provider            text,
  doctor              text,
  facility            text,
  status              text CHECK (status IN ('Verified', 'Pending', 'Flagged')),
  shared_with_parents boolean DEFAULT false,
  attachments         text[],
  created_at          timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medications (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  surrogate_id uuid REFERENCES public.users(id),
  user_id      uuid REFERENCES public.users(id),
  name         text NOT NULL,
  dosage       text,
  frequency    text,
  start_date   date NOT NULL,
  end_date     date,
  status       text CHECK (status IN ('Active', 'Completed', 'Discontinued')),
  notes        text,
  created_at   timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      uuid REFERENCES public.users(id),
  journey_id   uuid REFERENCES public.journeys(id),
  name         text NOT NULL,
  url          text NOT NULL,
  type         text,
  status       text DEFAULT 'pending',
  uploaded_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  journey_id  uuid REFERENCES public.journeys(id),
  user_id     uuid REFERENCES public.users(id),
  title       text NOT NULL,
  description text,
  date        timestamp with time zone NOT NULL,
  location    text,
  type        text,
  status      text DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
  participants text[],
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.baby_watch_updates (
  id                  uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  journey_id          uuid REFERENCES public.journeys(id) NOT NULL,
  title               text NOT NULL,
  description         text,
  update_type         text CHECK (update_type IN ('Ultrasound', 'Growth', 'Milestone', 'Other')),
  data                jsonb DEFAULT '{}'::jsonb,
  attachments         text[],
  shared_with_parents boolean DEFAULT true,
  author_id           uuid REFERENCES public.users(id),
  created_at          timestamp with time zone DEFAULT now()
);
ALTER TABLE public.baby_watch_updates ADD COLUMN IF NOT EXISTS shared_with_parents boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  journey_id      uuid REFERENCES public.journeys(id),
  title           text,
  last_message    text,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at      timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role            text,
  joined_at       timestamp with time zone DEFAULT now(),
  unread_count    int DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid REFERENCES public.users(id) NOT NULL,
  content         text NOT NULL,
  attachments     text[],
  is_read         boolean DEFAULT false,
  created_at      timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES public.users(id),
  journey_id  uuid REFERENCES public.journeys(id),
  title       text NOT NULL,
  description text,
  due_date    date,
  priority    text CHECK (priority IN ('Low', 'Medium', 'High')),
  status      text DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  journey_id       uuid REFERENCES public.journeys(id),
  surrogate_id     uuid REFERENCES public.users(id),
  parent_id        uuid REFERENCES public.users(id),
  amount           decimal(12,2) NOT NULL,
  type             text CHECK (type IN ('Base Compensation','Allowance','Medical','Travel','Clothing','Legal','Other')),
  category         text CHECK (category IN ('Withdrawn', 'Received')),
  status           text CHECK (status IN ('Paid','Pending','Scheduled','Overdue','Cancelled','Rejected')),
  due_date         date NOT NULL,
  paid_date        date,
  description      text,
  reference_number text,
  created_at       timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title            text NOT NULL,
  type             text,
  surrogate_name   text,
  parent_name      text,
  status           text NOT NULL DEFAULT 'draft',
  value            numeric(12, 2),
  surrogate_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  parent_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  journey_id       uuid REFERENCES public.journeys(id) ON DELETE SET NULL,
  esign_status     text DEFAULT 'Not Sent'
    CHECK (esign_status IN (
      'Not Sent', 'Sent to GC', 'Sent to IP', 'Partially Signed',
      'Fully Signed', 'Expired'
    )),
  esign_sent_at    timestamptz,
  esign_signed_at  timestamptz,
  document_url     text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_status     ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_ip         ON public.matches(intended_parent_id);
CREATE INDEX IF NOT EXISTS idx_matches_gc         ON public.matches(gestational_carrier_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status    ON public.journeys(status);
CREATE INDEX IF NOT EXISTS idx_journeys_stage     ON public.journeys(stage);
CREATE INDEX IF NOT EXISTS idx_journeys_match_id  ON public.journeys(match_id);
CREATE INDEX IF NOT EXISTS idx_contracts_journey   ON public.contracts(journey_id);
CREATE INDEX IF NOT EXISTS idx_contracts_parent     ON public.contracts(parent_id);
CREATE INDEX IF NOT EXISTS idx_contracts_surrogate  ON public.contracts(surrogate_id);

-- ─── ENABLE RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journeys               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_financials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_screening      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_watch_updates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts              ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES ─────────────────────────────────────────────────────────────

-- Users
DROP POLICY IF EXISTS "user_view_self"    ON public.users;
DROP POLICY IF EXISTS "user_update_self"  ON public.users;
DROP POLICY IF EXISTS "admin_view_all"    ON public.users;
DROP POLICY IF EXISTS "admin_all_access"  ON public.users;
-- Drop legacy recursive policies
DROP POLICY IF EXISTS "Users can view their own profile"  ON public.users;
DROP POLICY IF EXISTS "Admins have full access"           ON public.users;
DROP POLICY IF EXISTS "Individuals can view their own user data" ON public.users;

CREATE POLICY "user_view_self"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "user_update_self" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin_view_all"   ON public.users FOR SELECT USING (public.check_is_admin());
CREATE POLICY "admin_all_access" ON public.users FOR ALL    USING (public.check_is_admin());

-- Matches
DROP POLICY IF EXISTS "matches_admin_full"        ON public.matches;
DROP POLICY IF EXISTS "matches_participant_view"  ON public.matches;
DROP POLICY IF EXISTS "matches_view_all"          ON public.matches;
CREATE POLICY "matches_admin_full"       ON public.matches FOR ALL    USING (public.check_is_admin());
CREATE POLICY "matches_participant_view" ON public.matches FOR SELECT
  USING (auth.uid() = intended_parent_id OR auth.uid() = gestational_carrier_id);

-- Journeys
DROP POLICY IF EXISTS "journeys_admin_full"       ON public.journeys;
DROP POLICY IF EXISTS "journeys_participant_view" ON public.journeys;
DROP POLICY IF EXISTS "journeys_view_all"         ON public.journeys;
CREATE POLICY "journeys_admin_full"      ON public.journeys FOR ALL    USING (public.check_is_admin());
CREATE POLICY "journeys_participant_view" ON public.journeys FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = surrogate_id);

-- Agency Financials (admin only)
DROP POLICY IF EXISTS "financials_admin_only" ON public.agency_financials;
DROP POLICY IF EXISTS "Financials are Admin only" ON public.agency_financials;
CREATE POLICY "financials_admin_only" ON public.agency_financials FOR ALL USING (public.check_is_admin());

-- Medical Screening (admin full; surrogate can view own)
DROP POLICY IF EXISTS "screening_admin_all"  ON public.medical_screening;
DROP POLICY IF EXISTS "screening_view_own"   ON public.medical_screening;
DROP POLICY IF EXISTS "Medical Screening is Admin only" ON public.medical_screening;
CREATE POLICY "screening_admin_all" ON public.medical_screening FOR ALL    USING (public.check_is_admin());
CREATE POLICY "screening_view_own"  ON public.medical_screening FOR SELECT USING (auth.uid() = surrogate_id);

-- Medical Records
DROP POLICY IF EXISTS "records_admin_all" ON public.medical_records;
DROP POLICY IF EXISTS "records_view_own"  ON public.medical_records;
CREATE POLICY "records_admin_all" ON public.medical_records FOR ALL    USING (public.check_is_admin());
CREATE POLICY "records_view_own"  ON public.medical_records FOR SELECT USING (auth.uid() = surrogate_id OR auth.uid() = user_id);

-- Medications
DROP POLICY IF EXISTS "medications_admin_all" ON public.medications;
DROP POLICY IF EXISTS "medications_view_own"  ON public.medications;
CREATE POLICY "medications_admin_all" ON public.medications FOR ALL    USING (public.check_is_admin());
CREATE POLICY "medications_view_own"  ON public.medications FOR SELECT USING (auth.uid() = surrogate_id OR auth.uid() = user_id);

-- Documents
DROP POLICY IF EXISTS "documents_admin_all" ON public.documents;
DROP POLICY IF EXISTS "documents_view_own"  ON public.documents;
CREATE POLICY "documents_admin_all" ON public.documents FOR ALL    USING (public.check_is_admin());
CREATE POLICY "documents_view_own"  ON public.documents FOR SELECT USING (auth.uid() = user_id);

-- Appointments (appointments_view_all removed — use appointments_view_own for user_id + participants)
DROP POLICY IF EXISTS "appointments_view_all" ON public.appointments;
DROP POLICY IF EXISTS "appointments_admin_all" ON public.appointments;
DROP POLICY IF EXISTS "appointments_view_own" ON public.appointments;
CREATE POLICY "appointments_admin_all" ON public.appointments FOR ALL    USING (public.check_is_admin());
CREATE POLICY "appointments_view_own"  ON public.appointments FOR SELECT USING (
  auth.uid() = user_id
  OR (participants IS NOT NULL AND auth.uid()::text = ANY (participants))
);

-- Baby Watch
DROP POLICY IF EXISTS "updates_view_all"       ON public.baby_watch_updates;
DROP POLICY IF EXISTS "admin_all_baby_watch"   ON public.baby_watch_updates;
DROP POLICY IF EXISTS "baby_watch_admin_all"   ON public.baby_watch_updates;
DROP POLICY IF EXISTS "baby_watch_view_own"    ON public.baby_watch_updates;
CREATE POLICY "baby_watch_admin_all"  ON public.baby_watch_updates FOR ALL    USING (public.check_is_admin());
CREATE POLICY "baby_watch_view_own"   ON public.baby_watch_updates FOR SELECT
  USING (public.check_is_admin() OR EXISTS (
    SELECT 1 FROM public.journeys j
    WHERE j.id = journey_id AND (j.parent_id = auth.uid() OR j.surrogate_id = auth.uid())
  ));

-- Conversations
DROP POLICY IF EXISTS "conversations_view_all" ON public.conversations;
CREATE POLICY "conversations_view_all" ON public.conversations FOR SELECT
  USING (public.check_is_admin() OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
  ));

-- Messages
DROP POLICY IF EXISTS "messages_view_all" ON public.messages;
CREATE POLICY "messages_view_all" ON public.messages FOR SELECT
  USING (public.check_is_admin() OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
  ));

-- Tasks
DROP POLICY IF EXISTS "tasks_view_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_admin_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_view_own" ON public.tasks;
CREATE POLICY "tasks_admin_all"  ON public.tasks FOR ALL    USING (public.check_is_admin());
CREATE POLICY "tasks_view_own"   ON public.tasks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Payments
DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
DROP POLICY IF EXISTS "payments_view_own"  ON public.payments;
CREATE POLICY "payments_admin_all" ON public.payments FOR ALL    USING (public.check_is_admin());
CREATE POLICY "payments_view_own"  ON public.payments FOR SELECT USING (auth.uid() = surrogate_id OR auth.uid() = parent_id);

DROP POLICY IF EXISTS "contracts_admin_all" ON public.contracts;
DROP POLICY IF EXISTS "contracts_view_parties" ON public.contracts;
CREATE POLICY "contracts_admin_all" ON public.contracts FOR ALL
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());
CREATE POLICY "contracts_view_parties" ON public.contracts FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = surrogate_id);

-- ─── AUTH SYNC TRIGGER ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  raw_role   TEXT;
  final_role TEXT;
BEGIN
  raw_role := COALESCE(new.raw_user_meta_data->>'role', 'Admin');
  CASE
    WHEN LOWER(raw_role) IN ('admin','administrator')                                      THEN final_role := 'Admin';
    WHEN LOWER(raw_role) IN ('agency staff','agencystaff','agency_staff','staff')          THEN final_role := 'Agency Staff';
    WHEN LOWER(raw_role) IN ('intended parent','intendedparent','parent','ip')             THEN final_role := 'Intended Parent';
    WHEN LOWER(raw_role) IN ('surrogate','gestational carrier','gestationalcarrier','gc')  THEN final_role := 'Surrogate';
    ELSE final_role := 'Admin';
  END CASE;

  INSERT INTO public.users (id, email, first_name, last_name, full_name, role)
  VALUES (
    new.id,
    new.email,
    split_part(new.raw_user_meta_data->>'full_name', ' ', 1),
    substring(new.raw_user_meta_data->>'full_name' FROM position(' ' IN new.raw_user_meta_data->>'full_name') + 1),
    new.raw_user_meta_data->>'full_name',
    final_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    role      = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── MATCH LIFECYCLE TRIGGER ─────────────────────────────────────────────────
-- Handles: auto-cancel on decline, auto-activate on dual acceptance,
-- auto-create journey on activation.
-- FIX vs 20260307: journey is inserted with status='Active', stage='Medical Screening'
-- (old version used status='Medical Screening' which violates the CHECK constraint)
CREATE OR REPLACE FUNCTION public.handle_match_lifecycle_transitions()
RETURNS TRIGGER AS $$
DECLARE
  p_id           UUID;
  s_id           UUID;
  new_journey_id UUID;
  case_no        TEXT;
BEGIN
  p_id := NEW.intended_parent_id;
  s_id := NEW.gestational_carrier_id;

  -- 1. Auto-cancel if either party declines
  IF (NEW.parent_declined = TRUE OR NEW.surrogate_declined = TRUE) THEN
    IF NEW.status != 'Cancelled' THEN
      NEW.status := 'Cancelled';
      IF p_id IS NOT NULL THEN
        UPDATE public.users SET status = 'Accepted to Program' WHERE id = p_id;
      END IF;
      IF s_id IS NOT NULL THEN
        UPDATE public.users SET status = 'Accepted to Program' WHERE id = s_id;
      END IF;
    END IF;
  END IF;

  -- 2. Auto-activate when both parties accept
  IF (NEW.parent_accepted = TRUE AND NEW.surrogate_accepted = TRUE)
     AND (OLD.parent_accepted = FALSE OR OLD.surrogate_accepted = FALSE)
  THEN
    NEW.status := 'Active';
  END IF;

  -- 3. Auto-create journey when match becomes Active
  IF NEW.status = 'Active' AND (OLD.status IS NULL OR OLD.status != 'Active') THEN
    IF NOT EXISTS (SELECT 1 FROM public.journeys WHERE match_id = NEW.id) THEN
      case_no := 'CASE-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || SUBSTR(CAST(NEW.id AS TEXT), 1, 4);
      INSERT INTO public.journeys (match_id, parent_id, surrogate_id, status, stage, case_number, created_at)
      VALUES (NEW.id, p_id, s_id, 'Active', 'Medical Screening', case_no, NOW())
      RETURNING id INTO new_journey_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_match_lifecycle_transitions ON public.matches;
CREATE TRIGGER tr_handle_match_lifecycle_transitions
  BEFORE UPDATE OF parent_declined, surrogate_declined, parent_accepted, surrogate_accepted, status
  ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_match_lifecycle_transitions();
