-- ============================================================================
-- Migration: Reorganize Heartbeat Detection and NIPT in journey checklists
-- Date: 2026-11-05
--
-- 1. Moves any existing `preg_heartbeat` from Pregnancy checklist to Embryo Transfer's
--    `et_heartbeat_ultrasound` checklist item.
-- 2. Removes `preg_heartbeat` from Pregnancy checklist so `preg_nipt_scheduled`
--    can be tracked cleanly.
-- ============================================================================

UPDATE public.journeys
SET journey_notes = jsonb_set(
  jsonb_set(
    (journey_notes::jsonb #- '{stageChecklists,Pregnancy,preg_heartbeat}'::text[]),
    '{stageChecklists,Embryo Transfer}'::text[],
    COALESCE(journey_notes::jsonb #> '{stageChecklists,Embryo Transfer}'::text[], '{}'::jsonb),
    true
  ),
  '{stageChecklists,Embryo Transfer,et_heartbeat_ultrasound}'::text[],
  (journey_notes::jsonb #> '{stageChecklists,Pregnancy,preg_heartbeat}'::text[]),
  true
)
WHERE journey_notes IS NOT NULL
  AND (journey_notes::jsonb #> '{stageChecklists,Pregnancy,preg_heartbeat}'::text[]) IS NOT NULL;
