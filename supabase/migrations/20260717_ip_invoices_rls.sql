-- ============================================================================
-- Allow Intended Parents to read their own invoices in the app (2026-07-17)
-- The admin portal manages ip_invoices; this adds a read-only policy so an IP
-- can view their own pending/previous invoices in the mobile app.
-- Idempotent.
-- ============================================================================

ALTER TABLE public.ip_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ip_invoices_read_own" ON public.ip_invoices;
CREATE POLICY "ip_invoices_read_own" ON public.ip_invoices
  FOR SELECT USING (
    public.check_is_admin()
    OR intended_parent_id = auth.uid()
  );

-- Admin/agency full access (kept explicit so admin writes aren't blocked by RLS).
DROP POLICY IF EXISTS "ip_invoices_admin_all" ON public.ip_invoices;
CREATE POLICY "ip_invoices_admin_all" ON public.ip_invoices
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
