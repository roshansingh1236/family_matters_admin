-- Surrogate benefit packages are no longer linked to a journey.
-- Drops journey_id entirely (along with its FK and UNIQUE constraint).
-- WARNING: destructive — existing journey linkage on these rows is discarded.

ALTER TABLE public.surrogate_benefit_packages
  DROP COLUMN IF EXISTS journey_id;
