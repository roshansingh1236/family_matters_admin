-- Mobile app + admin: appointments may key the user by user_id (admin) or participants[] (legacy app).
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS participants TEXT[];

-- Older deployments may only have participant-based SELECT; drop so rows with user_id are visible.
DROP POLICY IF EXISTS "appointments_view_all" ON public.appointments;

DROP POLICY IF EXISTS "appointments_view_own" ON public.appointments;
CREATE POLICY "appointments_view_own" ON public.appointments FOR SELECT USING (
  auth.uid() = user_id
  OR (
    participants IS NOT NULL
    AND auth.uid()::text = ANY (participants)
  )
);
