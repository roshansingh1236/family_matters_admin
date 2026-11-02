// Wording and structure of the Family Matters Surrogacy "Surrogate Release of
// Medical Records" form, exactly as on the agency's paper form. Mirrors
// lib/utils/medical_release_content.dart in the mobile app, where the surrogate
// fills in and signs the form.

export const MEDICAL_RELEASE_TITLE = 'SURROGATE RELEASE OF MEDICAL RECORDS';

// Patient table
export const MEDICAL_RELEASE_PATIENT_NAME_LABEL = 'Name of Patient:';
export const MEDICAL_RELEASE_DOB_LABEL = 'Date of Birth:';
export const MEDICAL_RELEASE_SSN_LABEL = 'Social Security Number:';
export const MEDICAL_RELEASE_ADDRESS_LABEL = 'Address:';
export const MEDICAL_RELEASE_STREET_CAPTION = '(Street Address, including apartment number or unit number)';
export const MEDICAL_RELEASE_CITY_STATE_ZIP_CAPTION = '(City, State and Zip Code)';

export const MEDICAL_RELEASE_AUTHORIZATION =
  'I, the undersigned patient, hereby authorize the below to use or disclose my protected health information as indicated.';

// Provider table
export const MEDICAL_RELEASE_PROVIDER_NAME_CAPTION = '(Full name of OB Physician, OB Clinic, or Delivery Hospital)';
export const MEDICAL_RELEASE_PROVIDER_CONTACT_CAPTION = '(Physician, Clinic, or Hospital Phone Number and Fax Number)';

export const MEDICAL_RELEASE_TO_HEADING = 'RELEASE TO:';
export const MEDICAL_RELEASE_TO_NAME = 'Family Matters Surrogacy, LLC';
export const MEDICAL_RELEASE_TO_ADDRESS_LINES = [
  '8030 La Mesa Blvd. # 63',
  'La Mesa, CA 91942 Office: 619-251-7393',
];
export const MEDICAL_RELEASE_TO_EMAIL = 'breann@familymatterssurrogacy.com';
export const MEDICAL_RELEASE_TO_FAX = '619-828-6473';

export const MEDICAL_RELEASE_INFORMATION_HEADING = 'INFORMATION TO BE RELEASED:';

/** The three columns of the "information to be released" list, as on the paper form. */
export const MEDICAL_RELEASE_INFORMATION_COLUMNS = [
  ['OB Records (Flow Sheets)', 'Physical Exam', 'HIV /AIDS'],
  ['Delivery Records', 'Medications'],
  ['Lab Results', 'Ultrasound Reports'],
];

/** The numbered statements (1–6). */
export const MEDICAL_RELEASE_TERMS = [
  'I understand that this authorization will expire two years from my last date of service visit. A photocopy of this form will be considered as valid as an original signed copy.',
  'I understand that I may revoke this authorization at any time by notification in writing and this authorization will cease to be effective on the date notified except to the extent that action has already been taken in reliance upon it.',
  'I understand that information used or disclosed pursuant to this authorization may be subject to re-disclosure by the recipient from disclosing specially protected information, such as HIV /AIDS related information and psychiatric /mental health information.',
  'My health care and payment for health care will not be affected if I do not sign this form.',
  'I understand that my refusal to sign this authorization will not jeopardize my right to obtain present or future treatment for psychiatric disabilities except where disclosure of the information is necessary for treatment.',
  'I understand that I will receive a copy of this form once signed.',
];

export const MEDICAL_RELEASE_ACKNOWLEDGEMENT =
  'By signing below, I acknowledge that I have read and understand this authorization.';

export const MEDICAL_RELEASE_PRINTED_NAME_LABEL = 'Patient’s Printed Name:';
export const MEDICAL_RELEASE_SIGNATURE_LABEL = 'Patient’s Signature:';
export const MEDICAL_RELEASE_DATE_LABEL = 'Date:';

export const MEDICAL_RELEASE_FOOTER_TITLE = 'Surrogate Medical Release Form';
export const MEDICAL_RELEASE_FOOTER_WEBSITE = 'www.familymatterssurrogacy.com';

/** "San Diego, CA 92101" from the stored city / state / zip. */
export function formatCityStateZip(city: string, state: string, zip: string): string {
  const cityState = [city, state].map((p) => (p || '').trim()).filter(Boolean).join(', ');
  return [cityState, (zip || '').trim()].filter(Boolean).join(' ');
}

/** Phone and fax as written on the provider line of the form. */
export function formatProviderContact(phone: string, fax: string): string {
  const parts = [(phone || '').trim()];
  if ((fax || '').trim()) parts.push(`Fax: ${fax.trim()}`);
  return parts.filter(Boolean).join('     ');
}
