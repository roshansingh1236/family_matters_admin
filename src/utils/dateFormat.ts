// Date formatting helpers for the admin dashboard.
//
// Per client review: every user-facing date in the admin dashboard should
// display as MM/DD/YYYY (zero-padded). Use these helpers so the format stays
// consistent across screens. Mirror of the Flutter app's
// `surrogacyapp/lib/utils/date_formats.dart`.

/**
 * Format a date as `MM/DD/YYYY` (zero-padded month and day).
 *
 * Accepts a `Date`, an ISO/date string, a number (epoch ms), or null/undefined.
 * Returns an empty string when the input is missing or unparseable so callers
 * can render a safe fallback.
 */
export function formatMMDDYYYY(
  input: Date | string | number | null | undefined,
): string {
  if (input === null || input === undefined || input === '') return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Format a date as `MM/DD/YYYY`, returning the supplied fallback (default
 * `'N/A'`) when the input is missing or unparseable.
 */
export function formatMMDDYYYYOr(
  input: Date | string | number | null | undefined,
  fallback = 'N/A',
): string {
  const formatted = formatMMDDYYYY(input);
  return formatted === '' ? fallback : formatted;
}
