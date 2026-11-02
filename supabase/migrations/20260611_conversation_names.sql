-- ============================================================================
-- Named group conversations (2026-06-11)
--
-- Group threads (surrogate + parent + admin) had no name, so both apps fell
-- back to concatenating member names (ugly) and the admin portal labelled the
-- group by just one participant. Add a `name` column and give every existing
-- match group a proper name: "Care Team — <Parent> & <Surrogate>".
-- Idempotent.
-- ============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS name text;

-- Name existing "care team" groups: conversations that include an admin and
-- have 3+ distinct participants. Built from the non-admin members.
UPDATE public.conversations c
   SET name = 'Care Team — ' || COALESCE((
         SELECT string_agg(
                  COALESCE(NULLIF(trim(u.first_name), ''),
                           NULLIF(trim(u.full_name), ''),
                           'Member'),
                  ' & '
                  ORDER BY u.first_name
                )
           FROM (SELECT DISTINCT unnest(c.participants) AS pid) pp
           JOIN public.users u ON u.id = pp.pid
          WHERE u.role IS DISTINCT FROM 'Admin'
       ), 'Family')
 WHERE c.name IS NULL
   AND (SELECT count(DISTINCT x) FROM unnest(c.participants) AS x) >= 3
   AND EXISTS (
         SELECT 1
           FROM (SELECT DISTINCT unnest(c.participants) AS pid) q
           JOIN public.users u ON u.id = q.pid
          WHERE u.role = 'Admin'
       );
