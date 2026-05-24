import React, { useEffect, useMemo, useState } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import {
  ACCESS_CODE_LABELS,
  AccessCodeKey,
  DEFAULT_ACCESS_CODES,
  getAccessCode,
  resetAccessCode,
  setAccessCode,
} from '../../utils/accessCodes';

type ToastFn = (toast: { message: string; type: 'success' | 'error' } | null) => void;

interface Props {
  onToast?: ToastFn;
}

const AccessCodesSection: React.FC<Props> = ({ onToast }) => {
  // The keys we want admins to be able to change. Order matches the client's
  // priority — Medical Records Protected + Agency Financials Protected first.
  const codeKeys = useMemo<AccessCodeKey[]>(
    () => ['medical', 'financials', 'contracts', 'contacts'],
    []
  );

  const [drafts, setDrafts] = useState<Record<AccessCodeKey, string>>(() => {
    const initial = {} as Record<AccessCodeKey, string>;
    for (const k of codeKeys) initial[k] = getAccessCode(k);
    return initial;
  });
  const [revealed, setRevealed] = useState<Record<AccessCodeKey, boolean>>({
    contacts: false,
    contracts: false,
    financials: false,
    medical: false,
  });

  // Sync if codes change in another tab.
  useEffect(() => {
    const refresh = () => {
      const next = {} as Record<AccessCodeKey, string>;
      for (const k of codeKeys) next[k] = getAccessCode(k);
      setDrafts(next);
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [codeKeys]);

  const handleSave = (key: AccessCodeKey) => {
    const value = drafts[key].trim();
    if (value.length < 4) {
      onToast?.({ message: 'Access codes must be at least 4 characters.', type: 'error' });
      return;
    }
    setAccessCode(key, value);
    onToast?.({ message: `${ACCESS_CODE_LABELS[key]} access code updated.`, type: 'success' });
  };

  const handleReset = (key: AccessCodeKey) => {
    resetAccessCode(key);
    setDrafts((prev) => ({ ...prev, [key]: DEFAULT_ACCESS_CODES[key] }));
    onToast?.({ message: `${ACCESS_CODE_LABELS[key]} reset to default.`, type: 'success' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Access Codes</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Codes required to unlock protected sections like Medical Records and Agency Financials. Changes apply immediately to any open window.
        </p>
      </div>

      <Card className="border border-amber-100 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-900/30 p-4">
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          <i className="ri-information-line mr-1"></i>
          These codes are an extra confirmation step — they do <strong>not</strong> replace Supabase Row-Level Security. Share them only with authorized agency staff.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {codeKeys.map((key) => (
          <Card key={key} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">{ACCESS_CODE_LABELS[key]}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Default: <code className="font-mono">{DEFAULT_ACCESS_CODES[key]}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevealed((p) => ({ ...p, [key]: !p[key] }))}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700"
              >
                {revealed[key] ? <><i className="ri-eye-off-line mr-1"></i>Hide</> : <><i className="ri-eye-line mr-1"></i>Show</>}
              </button>
            </div>
            <input
              type={revealed[key] ? 'text' : 'password'}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/40"
              value={drafts[key]}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
            />
            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={() => handleSave(key)}>
                <i className="ri-save-line mr-1"></i> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleReset(key)}>
                <i className="ri-refresh-line mr-1"></i> Reset to default
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AccessCodesSection;
