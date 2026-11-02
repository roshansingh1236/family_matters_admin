// Access codes for protected admin sections (Medical Records, Agency Financials, etc.)
// Per client review, codes are configurable from Settings → Access Codes.
// Codes are stored in localStorage so admins can change them without a deploy.
// (NOTE: This is purely a UX gate, not a security boundary — Supabase RLS
// remains the authoritative protection layer.)

export const ACCESS_CODE_STORAGE_KEY = 'fms_access_codes_v1';

export type AccessCodeKey = 'contacts' | 'contracts' | 'financials' | 'medical';

export const DEFAULT_ACCESS_CODES: Record<AccessCodeKey, string> = {
  contacts: 'agency2026',
  contracts: 'legal2026',
  financials: 'money2026',
  medical: 'health2026',
};

export const ACCESS_CODE_LABELS: Record<AccessCodeKey, string> = {
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
