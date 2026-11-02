-- Allow intended parents and gestational carriers to read each other's user row
-- when they share a match (fixes empty joins / N/A on Match Details).
-- Allow the same participants to read journeys linked via matches.match_id
-- even if journeys.parent_id / surrogate_id were ever out of sync.

DROP POLICY IF EXISTS "user_view_match_counterpart" ON public.users;
CREATE POLICY "user_view_match_counterpart" ON public.users
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.intended_parent_id IS NOT NULL
      AND m.gestational_carrier_id IS NOT NULL
      AND (
        (m.intended_parent_id = (SELECT auth.uid()) AND m.gestational_carrier_id = users.id)
        OR
        (m.gestational_carrier_id = (SELECT auth.uid()) AND m.intended_parent_id = users.id)
      )
  )
);

DROP POLICY IF EXISTS "journeys_select_via_match" ON public.journeys;
CREATE POLICY "journeys_select_via_match" ON public.journeys
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = journeys.match_id
      AND (
        m.intended_parent_id = (SELECT auth.uid())
        OR m.gestational_carrier_id = (SELECT auth.uid())
      )
  )
);
