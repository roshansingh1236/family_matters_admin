-- ============================================================================
-- Blog / Resource articles (2026-06-27)
--
-- Backs the app's ArticleService (Home "Resource Center" + Blog) and the new
-- admin authoring page. Columns mirror the app's ArticleModel.
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.articles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  subtitle      text,
  content       text NOT NULL DEFAULT '',
  category      text,
  icon_name     text,
  color_hex     text,
  image_url     text,
  role_target   text NOT NULL DEFAULT 'both'
                  CHECK (role_target IN ('surrogate', 'parent', 'both')),
  is_published  boolean NOT NULL DEFAULT false,
  author_id     uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_published
  ON public.articles (is_published, role_target, created_at DESC);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read PUBLISHED articles (app surrogates/parents).
DROP POLICY IF EXISTS "articles_read_published" ON public.articles;
CREATE POLICY "articles_read_published" ON public.articles
  FOR SELECT USING (
    is_published = true
    OR public.check_is_admin()
  );

-- Admin / agency staff can create, update, delete.
DROP POLICY IF EXISTS "articles_admin_write" ON public.articles;
CREATE POLICY "articles_admin_write" ON public.articles
  FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.set_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_articles_updated_at ON public.articles;
CREATE TRIGGER tr_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.set_articles_updated_at();
