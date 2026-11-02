-- Surrogate Form 2 answers saved as true/false → 'Yes' / 'No'.
--
-- The mobile app's Form 2 saves these answers as text ('Yes', 'No', and for
-- some 'Maybe' or 'N/A'). The admin Intake Questionnaire used to edit them
-- as a boolean switch and save true/false, which the app cannot read back.
-- The portal now saves text (SurrogateIntakeFormView.tsx, CHOICE_KEYS); this
-- converts the booleans already stored.
--
-- Only surrogates, only these keys, and only values that are JSON booleans
-- are changed. Text answers are left as they are. postpartumDepression and
-- bedrest are free-text details in the app; a boolean there means the
-- original text was already overwritten, so 'Yes'/'No' is the best left.
--
-- The intake editor saved into whichever of these form_data objects existed,
-- so all are converted: surrogate_profile (what the app reads), form2, form1,
-- the top level of form_data, and the same inside a nested form_data.form_data.
--
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION pg_temp.yes_no_answers(obj jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN obj IS NULL OR jsonb_typeof(obj) <> 'object' THEN obj
    ELSE obj || COALESCE((
      SELECT jsonb_object_agg(
               key,
               CASE WHEN value = 'true'::jsonb THEN '"Yes"'::jsonb ELSE '"No"'::jsonb END
             )
      FROM jsonb_each(obj)
      WHERE jsonb_typeof(value) = 'boolean'
        AND key IN (
          'receivedVaccination', 'openToVaccination',
          'hasTransportation', 'canTravelForIVF', 'hasFlexibleSchedule',
          'hasCustody', 'hasCollegeDegree', 'isEmployed', 'partnerEmployed',
          'regularCycles', 'onBirthControl', 'isBreastfeeding', 'usedTHC',
          'postpartumDepression', 'bedrest',
          'hepatitisBVaccination', 'rhogamInjection', 'fertilityTreatments',
          'hadMiscarriage',
          'understandsAppointments', 'allowOBAppointments', 'allowDeliveryRoom',
          'helpCoupleWithChildren', 'helpSameSexCouple', 'helpSingleParent',
          'reduceTripletsToTwins', 'reduceTwinsToSingleton',
          'terminateIfNecessary', 'terminateDownSyndrome',
          'amniocentesis', 'agreeToFetalTesting', 'willingForSplitTwins'
        )
    ), '{}'::jsonb)
  END
$$;

-- One form_data object: its own top-level answers plus the form objects in it.
CREATE OR REPLACE FUNCTION pg_temp.yes_no_form_data(fd jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN fd IS NULL OR jsonb_typeof(fd) <> 'object' THEN fd
    ELSE pg_temp.yes_no_answers(fd)
      || CASE WHEN jsonb_typeof(fd -> 'surrogate_profile') = 'object'
              THEN jsonb_build_object('surrogate_profile', pg_temp.yes_no_answers(fd -> 'surrogate_profile'))
              ELSE '{}'::jsonb END
      || CASE WHEN jsonb_typeof(fd -> 'form2') = 'object'
              THEN jsonb_build_object('form2', pg_temp.yes_no_answers(fd -> 'form2'))
              ELSE '{}'::jsonb END
      || CASE WHEN jsonb_typeof(fd -> 'form1') = 'object'
              THEN jsonb_build_object('form1', pg_temp.yes_no_answers(fd -> 'form1'))
              ELSE '{}'::jsonb END
  END
$$;

WITH converted AS (
  SELECT
    id,
    pg_temp.yes_no_form_data(form_data)
      || CASE WHEN jsonb_typeof(form_data -> 'form_data') = 'object'
              THEN jsonb_build_object('form_data', pg_temp.yes_no_form_data(form_data -> 'form_data'))
              ELSE '{}'::jsonb END
      AS new_form_data
  FROM public.users
  WHERE role = 'Surrogate'
    AND jsonb_typeof(form_data) = 'object'
)
UPDATE public.users u
SET form_data = c.new_form_data,
    updated_at = now()
FROM converted c
WHERE u.id = c.id
  AND c.new_form_data IS DISTINCT FROM u.form_data;

-- Check: surrogates with a boolean still in surrogate_profile for these keys
-- (should return no rows):
-- SELECT id, key, value
-- FROM public.users, jsonb_each(form_data -> 'surrogate_profile')
-- WHERE role = 'Surrogate' AND jsonb_typeof(value) = 'boolean'
--   AND key IN ('hasTransportation', 'allowDeliveryRoom', 'willingForSplitTwins', 'usedTHC');
