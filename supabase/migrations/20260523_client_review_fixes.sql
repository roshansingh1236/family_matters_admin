-- ============================================================================
-- Client review fixes (2026-05-23)
--
-- Adds the schema pieces required by the UI changes shipped in this round:
--   * MR Review match stage  (Match Management)
--   * matches.data jsonb     (Match Progression checklist)
--   * Guest participant role (Appointments → Add new participant)
--
-- Everything is idempotent (IF NOT EXISTS / DROP+RE-ADD) so it's safe to
-- re-run. No data is destroyed.
-- ============================================================================

-- ─── 1. Allow "MR Review" as a match status ────────────────────────────────
-- Code: family_matters_admin/src/types/index.ts MatchStatus
--       family_matters_admin/src/components/feature/CreateMatchDialog.tsx
-- Without this, UPDATE matches SET status='MR Review' fails the CHECK
-- constraint introduced by 20260307_match_auto_cancellation.sql /
-- full_schema_reset.sql.
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check
  CHECK (status IN (
    'Proposed',
    'Presented',
    'MR Review',
    'Accepted',
    'Active',
    'Delivered',
    'Escrow Closure',
    'Completed',
    'Cancelled',
    -- Keep legacy values accepted so older rows don't violate the constraint.
    'Dissolved',
    'Declined'
  ));

-- ─── 2. matches.data jsonb (Match Progression checklist) ───────────────────
-- Code: family_matters_admin/src/services/matchService.ts updateMatchData
--       family_matters_admin/src/pages/matches/page.tsx handleToggleChecklistItem
-- The Match Progression checklist persists into matches.data.checklist.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── 3. Allow "Other" as a user role (guest appointment participants) ──────
-- Code: family_matters_admin/src/components/feature/MultiUserSelector.tsx
-- When an admin adds a brand-new participant via the appointment dropdown,
-- the inserted users row defaults to role='Other'. The existing CHECK in
-- full_schema_reset.sql limits role to a closed set.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
  END IF;
  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IS NULL OR role IN (
      'Intended Parent',
      'Surrogate',
      'Agency Staff',
      'Admin',
      'Other'
    ));
END $$;

-- ─── 4. inquiry_source backfill for app sign-ups (safety net) ──────────────
-- Code: surrogacyapp/lib/ui/Registration/create_account_screen.dart
--       surrogacyapp/lib/services/supabase_database_service.dart
-- The app now sets inquiry_source='App' on first insert. Backfill any
-- existing rows that lack a source so the All Inquiries view shows them
-- under the App filter.
UPDATE public.users
   SET inquiry_source = 'App'
 WHERE role = 'Intended Parent'
   AND (inquiry_source IS NULL OR inquiry_source = '')
   AND (
     -- Best-effort heuristic: profile_completed_at is set OR the row was
     -- self-created (no admin-recorded source elsewhere).
     profile_completed_at IS NOT NULL
     OR created_at > '2026-01-01'
   );

-- ─── 5. Sanity: ensure messages.timestamp + realtime publication exist ─────
-- Already established by 20260408_fix_messaging_rls.sql; repeated here so a
-- fresh database picks them up regardless of run order.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS "timestamp" timestamptz DEFAULT now();
UPDATE public.messages SET "timestamp" = created_at WHERE "timestamp" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
END $$;
