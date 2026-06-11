// Keeps the two approval signals in sync.
//
// A user's agency approval is tracked by the boolean `agency_approved`, but the
// user's lifecycle also lives in the separate `status` field. The mobile app's
// dashboards treat certain statuses as "approved" (so the Awaiting Agency
// Approval card disappears and matching unlocks). If an admin advances a user to
// a post-approval status without flipping `agency_approved`, the two drift apart
// and the user gets stuck on the awaiting-approval screen.
//
// Any status at or beyond approval implies the agency has cleared the user, so
// whenever we write one of these statuses we also set `agency_approved = true`.

// Statuses that imply the agency has approved the user. Compared case-insensitively.
const APPROVED_STATUSES = new Set([
  'approved',
  'accepted to program',
  'match pending',   // intended parent — match-eligible (post-approval)
  'ready to match',  // surrogate — match-eligible (post-approval)
  'matched',
  'active',
]);

export function isApprovedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return APPROVED_STATUSES.has(status.toString().trim().toLowerCase());
}

/**
 * Returns the extra `users` columns to merge into an update so that
 * `agency_approved` stays consistent with a status change.
 *
 * - Advancing to a post-approval status → sets `agency_approved = true` (+ timestamp).
 * - Other statuses → returns `{}` (does NOT revoke approval; revoking is an
 *   explicit admin action via the AgencyApprovalToggle).
 *
 * Spread the result into your update payload, e.g.:
 *   .update({ status: newStatus, ...approvalSyncFields(newStatus), updated_at })
 */
export function approvalSyncFields(
  newStatus: string | null | undefined,
): Record<string, unknown> {
  if (!isApprovedStatus(newStatus)) return {};
  return {
    agency_approved: true,
    agency_approved_at: new Date().toISOString(),
  };
}
