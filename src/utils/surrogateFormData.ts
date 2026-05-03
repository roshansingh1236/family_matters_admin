/**
 * Resolve surrogate intake JSON for admin UI.
 * Flutter saves the full SurrogacyForm + follow-on steps under form_data.surrogate_profile.
 * Older / alternate rows may use a top-level form2 JSONB column or form_data.form2.
 * Registration data is often at the top level of form_data.
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
  const fromForm1 = formData?.form1 as Record<string, unknown> | undefined;

  // If a profile exists (Detailed intake), we prefer that
  if (isNonEmptyRecord(fromProfile)) return fromProfile;
  if (isNonEmptyRecord(fromCol)) return fromCol;
  if (isNonEmptyRecord(fromNested)) return fromNested;
  if (isNonEmptyRecord(fromForm1)) return fromForm1;

  // FALLBACK: If "Detailed Intake" information is missing from specific keys, 
  // use the top-level formData itself (which contains Initial Signup info)
  if (isNonEmptyRecord(formData)) {
    // Exclude keys that are known to be containers for other forms
    const { surrogate_profile, form2, form1, gc_additional, additional_profile, ...initialSignup } = formData;
    if (Object.keys(initialSignup).length > 0) return initialSignup;
  }

  return null;
}

export function resolveSurrogateAdditionalProfile(
  formData: Record<string, unknown>,
  row: Record<string, unknown>
): Record<string, unknown> | null {
  const profile = formData?.surrogate_profile as Record<string, unknown> | undefined;
  const col = (row?.form2_data ?? row?.form2Data) as Record<string, unknown> | undefined;
  const nested = (formData?.gc_additional ??
    formData?.additional_profile) as Record<string, unknown> | undefined;

  // Merge them prioritizing newest fields
  const merged = {
    ...(isNonEmptyRecord(profile) ? profile : {}),
    ...(isNonEmptyRecord(col) ? col : {}),
    ...(isNonEmptyRecord(nested) ? nested : {}),
  };

  return Object.keys(merged).length > 0 ? (merged as Record<string, unknown>) : null;
}

/** 
 * Resolve parent additional profile (ip_additional).
 * Merges ip_additional with medical_reports and legacy form2_data.
 */
export function resolveParentAdditionalProfile(
  formData: Record<string, unknown>,
  row: Record<string, unknown>
): Record<string, unknown> | null {
  // Handle double nesting if form_data column contains a JSON object with another "form_data" key
  const fd = isNonEmptyRecord(formData?.form_data) 
    ? (formData.form_data as Record<string, unknown>) 
    : formData;

  const col = (row?.form2_data ?? row?.form2Data) as Record<string, unknown> | undefined;
  const ipAdd = fd?.ip_additional as Record<string, unknown> | undefined;
  const medRep = fd?.medical_reports as Record<string, unknown> | undefined;
  const fertility = (fd?.fertility_questions ?? fd?.fertility) as Record<string, unknown> | undefined;
  const surrRel = (fd?.surrogate_related ?? fd?.questions) as Record<string, unknown> | undefined;

  // Merge them prioritizing newest fields
  const merged = {
    ...(typeof col === 'object' ? col : {}),
    ...(typeof medRep === 'object' ? medRep : {}),
    ...(typeof ipAdd === 'object' ? ipAdd : {}),
    ...(typeof fertility === 'object' ? fertility : {}),
    ...(typeof surrRel === 'object' ? surrRel : {}),
    // Fallback: if questions is a string (legacy/registration), include it as additional_info
    ...(typeof fd?.questions === 'string' ? { additional_info: fd.questions } : {}),
    ...(typeof fd?.whySurrogate === 'string' ? { why_surrogacy: fd.whySurrogate } : {}),
    ...(typeof fd?.message === 'string' ? { message_to_surrogate: fd.message } : {}),
    ...(typeof fd?.clinic === 'string' ? { fertility_doctor: fd.clinic } : {}),
  };

  return Object.keys(merged).length > 0 ? (merged as Record<string, unknown>) : null;
}
