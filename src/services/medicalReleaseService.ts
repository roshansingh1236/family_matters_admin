import { supabase } from '../lib/supabase';

/** A surrogate's signed "Release of Medical Records" form (PHI). */
export interface MedicalRelease {
  id: string;
  userId: string;
  patientName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  ssn: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  providerName: string;
  providerPhone: string;
  providerFax: string;
  printedName: string;
  /** base64-encoded PNG of the drawn signature */
  signaturePng: string;
  signedAt: string;
  formVersion: string;
}

const TABLE_NAME = 'medical_release_forms';

const mapFromDb = (row: any): MedicalRelease => ({
  id: row.id,
  userId: row.user_id,
  patientName: row.patient_name ?? '',
  dateOfBirth: row.date_of_birth ?? '',
  ssn: row.ssn ?? '',
  streetAddress: row.street_address ?? '',
  city: row.city ?? '',
  state: row.state ?? '',
  zip: row.zip ?? '',
  providerName: row.provider_name ?? '',
  providerPhone: row.provider_phone ?? '',
  providerFax: row.provider_fax ?? '',
  printedName: row.printed_name ?? '',
  signaturePng: row.signature_png ?? '',
  signedAt: row.signed_at ?? '',
  formVersion: row.form_version ?? '',
});

/** `123-45-6789` → `***-**-6789` */
export function maskSsn(ssn: string): string {
  const digits = (ssn || '').replace(/\D/g, '');
  if (digits.length < 4) return digits ? '***-**-****' : '';
  return `***-**-${digits.slice(-4)}`;
}

/** Formats a stored `YYYY-MM-DD` date (or ISO timestamp) as `MM/DD/YYYY`. */
export function formatReleaseDate(value: string): string {
  if (!value) return '';
  // A plain calendar date must not be shifted by the viewer's time zone.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) return `${plain[2]}/${plain[3]}/${plain[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export const medicalReleaseService = {
  /** The signed release for a surrogate, or null when she hasn't signed yet. */
  getByUserId: async (userId: string): Promise<MedicalRelease | null> => {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapFromDb(data) : null;
  },

  /**
   * Removes a signed release so the surrogate is asked to fill in and sign the
   * form again in the app.
   */
  remove: async (id: string): Promise<void> => {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
    if (error) throw error;
  },
};
