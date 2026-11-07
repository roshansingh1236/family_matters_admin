-- tasks.is_completed for app versions already installed.
--
-- Task completion is tasks.status ('Completed' or not). The portal and the
-- mobile app also sent an is_completed column that the table never had, so
-- every insert / update that included it failed: the admin couldn't save or
-- complete tasks, and surrogates / parents couldn't tick a task done.
--
-- The portal and the app no longer send it. This adds the column so the app
-- builds already on people's phones work again too, and keeps it in step with
-- status (status stays the source of truth).
--
-- Safe to run more than once.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

UPDATE public.tasks
   SET is_completed = (status = 'Completed')
 WHERE is_completed IS DISTINCT FROM (status = 'Completed');

CREATE OR REPLACE FUNCTION public.tasks_sync_is_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- An older app may send only is_completed when ticking a task; carry that
  -- into status. Otherwise status decides.
  IF TG_OP = 'UPDATE'
     AND NEW.is_completed IS DISTINCT FROM OLD.is_completed
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    NEW.status := CASE WHEN NEW.is_completed THEN 'Completed' ELSE 'Pending' END;
  END IF;
  NEW.is_completed := (NEW.status = 'Completed');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_sync_is_completed ON public.tasks;
CREATE TRIGGER tasks_sync_is_completed
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_is_completed();
