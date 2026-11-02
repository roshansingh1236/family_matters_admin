-- Contracts: legal agreements (admin UI contractService + e-sign fields).
-- Fixes: relation "contracts" does not exist (prior scripts only ALTERed this table).

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

CREATE TABLE IF NOT EXISTS public.contracts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS idx_contracts_journey ON public.contracts(journey_id);
CREATE INDEX IF NOT EXISTS idx_contracts_parent ON public.contracts(parent_id);
CREATE INDEX IF NOT EXISTS idx_contracts_surrogate ON public.contracts(surrogate_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_admin_all" ON public.contracts;
DROP POLICY IF EXISTS "contracts_view_parties" ON public.contracts;

CREATE POLICY "contracts_admin_all" ON public.contracts FOR ALL
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

CREATE POLICY "contracts_view_parties" ON public.contracts FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = surrogate_id);
