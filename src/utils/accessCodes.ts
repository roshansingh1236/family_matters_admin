import { supabase } from '../lib/supabase';

// Access codes for protected admin sections (Medical Records, Agency Financials, etc.)
// Per client review, codes are configurable from Settings → Access Codes.
// Codes are stored in localStorage so admins can change them without a deploy.
// (NOTE: This is purely a UX gate, not a security boundary — Supabase RLS
// remains the authoritative protection layer.)

export const ACCESS_CODE_STORAGE_KEY = 'fms_access_codes_v1';
export const ACCESS_CODES_SECTION_KEY = 'access_codes';
export const DEFAULT_MASTER_PASSWORD = 'Welcome@123';

export type AccessCodeKey = 'agency_documents' | 'contacts' | 'contracts' | 'financials' | 'medical';

export const DEFAULT_ACCESS_CODES: Record<AccessCodeKey, string> = {
  agency_documents: 'agencydocs2026',
  contacts: 'agency2026',
  contracts: 'legal2026',
  financials: 'money2026',
  medical: 'health2026',
};

export const ACCESS_CODE_LABELS: Record<AccessCodeKey, string> = {
  agency_documents: 'Agency Documents (Surrogates & Parents)',
  contacts: 'Contacts',
  contracts: 'Contracts',
  financials: 'Agency Financials',
  medical: 'Medical Records',
};

export function getStoredAccessCodes(): Partial<Record<AccessCodeKey, string>> {
  try {
    const raw = localStorage.getItem(ACCESS_CODE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<AccessCodeKey, string>> = {};
    for (const key of Object.keys(DEFAULT_ACCESS_CODES) as AccessCodeKey[]) {
      if (typeof parsed[key] === 'string' && parsed[key].trim().length > 0) {
        out[key] = parsed[key];
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getAccessCode(key: AccessCodeKey): string {
  const stored = getStoredAccessCodes();
  return stored[key] ?? DEFAULT_ACCESS_CODES[key];
}

export function setAccessCode(key: AccessCodeKey, value: string): void {
  const current = getStoredAccessCodes();
  const next = { ...current, [key]: value };
  localStorage.setItem(ACCESS_CODE_STORAGE_KEY, JSON.stringify(next));
  // Notify other tabs/components.
  try {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: ACCESS_CODE_STORAGE_KEY,
        newValue: JSON.stringify(next),
      })
    );
  } catch {
    // Some browsers throw constructing StorageEvent — best effort only.
  }
}

export function resetAccessCode(key: AccessCodeKey): void {
  const current = getStoredAccessCodes();
  delete current[key];
  localStorage.setItem(ACCESS_CODE_STORAGE_KEY, JSON.stringify(current));
  try {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: ACCESS_CODE_STORAGE_KEY,
        newValue: JSON.stringify(current),
      })
    );
  } catch {
    // ignore
  }
}

/**
 * Verifies the master password for the Access Codes section against the Supabase backend.
 * The master password is never stored or hardcoded in frontend code.
 */
export async function verifyAccessCodesMasterPassword(password: string): Promise<boolean> {
  const trimmed = password.trim();
  if (!trimmed) return false;

  const { data, error } = await supabase.rpc('verify_access_codes_password', {
    entered_password: trimmed,
  });

  if (error) {
    console.error('Error verifying access codes master password:', error);
    if (error.message?.includes('does not exist') || error.code === 'PGRST202') {
      throw new Error(
        'Database setup required: Please run the migration (20261105_access_codes_password_protection.sql) in Supabase SQL editor.'
      );
    }
    throw new Error(error.message || 'Verification failed. Please try again.');
  }

  return Boolean(data);
}

/**
 * Fetches the current master password for the Access Codes section from the backend.
 */
export async function fetchAccessCodesMasterPassword(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_access_codes_password');
    if (error) {
      console.warn('Could not fetch master password from RPC, using default:', error.message);
      return DEFAULT_MASTER_PASSWORD;
    }
    return (data as string) || DEFAULT_MASTER_PASSWORD;
  } catch (err) {
    console.warn('Error fetching master password, fallback to default:', err);
    return DEFAULT_MASTER_PASSWORD;
  }
}

/**
 * Updates the master password for the Access Codes section in the backend.
 */
export async function updateAccessCodesMasterPassword(newPassword: string): Promise<void> {
  const trimmed = newPassword.trim();
  if (trimmed.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const { error } = await supabase.rpc('set_access_codes_password', {
    new_password: trimmed,
  });

  if (error) {
    console.error('Error updating master password:', error);
    throw new Error(error.message || 'Failed to update master password');
  }
}

/**
 * Resets the master password for the Access Codes section back to default (Welcome@123).
 */
export async function resetAccessCodesMasterPassword(): Promise<void> {
  const { error } = await supabase.rpc('reset_access_codes_password');
  if (error) {
    console.error('Error resetting master password:', error);
    // If RPC doesn't exist, try set_access_codes_password with default
    await updateAccessCodesMasterPassword(DEFAULT_MASTER_PASSWORD);
  }
}


