/**
 * Resolve surrogate intake JSON for admin UI.
 * Flutter saves the full SurrogacyForm + follow-on steps under form_data.surrogate_profile.
 * Older / alternate rows may use a top-level form2 JSONB column or form_data.form2 — an empty
 * object {} in form2 must not hide surrogate_profile (nullish coalescing treats {} as present).
 */
export function isNonEmptyRecord(v: unknown): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v as Record<string, unknown>).length > 0
  );
}

export function resolveSurrogateIntakeProfile(
  formData: Record<string, unknown>,
  row: Record<string, unknown>
): Record<string, unknown> | null {
  const fromProfile = formData?.surrogate_profile as Record<string, unknown> | undefined;
  const fromCol = row?.form2 as Record<string, unknown> | undefined;
  const fromNested = formData?.form2 as Record<string, unknown> | undefined;

  if (isNonEmptyRecord(fromProfile)) return fromProfile;
  if (isNonEmptyRecord(fromCol)) return fromCol;
  if (isNonEmptyRecord(fromNested)) return fromNested;

  if (fromProfile && typeof fromProfile === 'object') return fromProfile;
  if (fromCol && typeof fromCol === 'object') return fromCol;
  if (fromNested && typeof fromNested === 'object') return fromNested;

  return null;
}

/** Admin-only / extended fields; app can write to form_data.gc_additional. Legacy: form2_data column. */
export function resolveSurrogateAdditionalProfile(
  formData: Record<string, unknown>,
  row: Record<string, unknown>
): Record<string, unknown> | null {
  const col = (row?.form2_data ?? row?.form2Data) as Record<string, unknown> | undefined;
  const nested = (formData?.gc_additional ??
    formData?.additional_profile) as Record<string, unknown> | undefined;

  if (isNonEmptyRecord(col)) return col;
  if (isNonEmptyRecord(nested)) return nested;
  if (col && typeof col === 'object') return col;
  if (nested && typeof nested === 'object') return nested;
  return null;
}
