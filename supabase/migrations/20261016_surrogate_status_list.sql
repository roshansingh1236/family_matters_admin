-- Surrogate status list approved by the client on 2026-10-16
-- ("User Status Confirmation" sheet + automatic "Review Medical Records" after
-- Form 2 + On Hold + Rejected). Converts existing surrogates' old status names
-- to the new list. Intended-parent statuses are not touched.
--
-- New list (order):
--   New Application, Reviewed/Contacted, Profile Sent, Profile Received,
--   Review Medical Records, Interview Scheduled, Medical Records Requested,
--   Medical Records Received, Psych Evaluation, Psych Complete,
--   Accepted into Program, Ready to Match, On Hold, Rejected
--
-- Same mapping as surrogacyapp/lib/utils/surrogate_status.dart (_legacy).
-- Safe to run more than once.

UPDATE public.users
SET status = CASE lower(trim(status))
    WHEN 'pending'                            THEN 'New Application'
    WHEN 'new'                                THEN 'New Application'
    WHEN 'new application pending'            THEN 'New Application'
    WHEN 'reviewed'                           THEN 'Reviewed/Contacted'
    WHEN 'contacted'                          THEN 'Reviewed/Contacted'
    WHEN 'follow up'                          THEN 'Reviewed/Contacted'
    WHEN 'follow-up'                          THEN 'Reviewed/Contacted'
    WHEN 'documents pending'                  THEN 'Profile Sent'
    -- No separate review / background-check steps in the new list: these
    -- surrogates already have their records in, next step is Psych Evaluation.
    WHEN 'medical records reviewed'           THEN 'Medical Records Received'
    WHEN 'background check pending'           THEN 'Medical Records Received'
    WHEN 'background check complete'          THEN 'Medical Records Received'
    WHEN 'psychological evaluation scheduled' THEN 'Psych Evaluation'
    WHEN 'psychological evaluation complete'  THEN 'Psych Complete'
    WHEN 'accepted to program'                THEN 'Accepted into Program'
    WHEN 'declined / inactive'                THEN 'Rejected'
    ELSE status
  END,
  updated_at = now()
WHERE role = 'Surrogate'
  AND lower(trim(status)) IN (
    'pending', 'new', 'new application pending',
    'reviewed', 'contacted', 'follow up', 'follow-up',
    'documents pending',
    'medical records reviewed', 'background check pending', 'background check complete',
    'psychological evaluation scheduled', 'psychological evaluation complete',
    'accepted to program',
    'declined / inactive'
  );

-- What is left after the update (anything not in the new list shows here):
-- SELECT status, count(*) FROM public.users WHERE role = 'Surrogate' GROUP BY 1 ORDER BY 2 DESC;
