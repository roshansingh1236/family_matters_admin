import React, { useEffect, useMemo, useState } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import { useAuth } from '../../contexts/AuthContext';
import { canManageAccessCodes } from '../../utils/permissions';
import { lockProtectedSection } from './PasswordProtection';
import {
  ACCESS_CODE_LABELS,
  DEFAULT_ACCESS_CODES,
  DEFAULT_MASTER_PASSWORD,
  fetchAccessCodesMasterPassword,
  getAccessCode,
  resetAccessCode,
  resetAccessCodesMasterPassword,
  setAccessCode,
  updateAccessCodesMasterPassword,
} from '../../utils/accessCodes';
import type { AccessCodeKey } from '../../utils/accessCodes';

type ToastFn = (toast: { message: string; type: 'success' | 'error' } | null) => void;

interface Props {
  onToast?: ToastFn;
}

const AccessCodesSection: React.FC<Props> = ({ onToast }) => {
  const { profile } = useAuth();
  const hasAccess = canManageAccessCodes(profile?.role);

  // The keys we want admins to be able to change for individual section access.
  const codeKeys = useMemo<AccessCodeKey[]>(
    () => ['agency_documents', 'medical', 'financials', 'contracts', 'contacts'],
    []
  );

  const [drafts, setDrafts] = useState<Record<AccessCodeKey, string>>(() => {
    const initial = {} as Record<AccessCodeKey, string>;
    for (const k of codeKeys) initial[k] = getAccessCode(k);
    return initial;
  });

  const [revealed, setRevealed] = useState<Record<AccessCodeKey, boolean>>({
    agency_documents: false,
    contacts: false,
    contracts: false,
    financials: false,
    medical: false,
  });

  // Master Access Codes Section password state
  const [masterPassword, setMasterPassword] = useState<string>('');
  const [masterRevealed, setMasterRevealed] = useState<boolean>(false);
  const [masterLoading, setMasterLoading] = useState<boolean>(true);
  const [masterSaving, setMasterSaving] = useState<boolean>(false);

  // Fetch master password from backend
  useEffect(() => {
    let isMounted = true;
    setMasterLoading(true);
    fetchAccessCodesMasterPassword()
      .then((pwd) => {
        if (isMounted) {
          setMasterPassword(pwd);
        }
      })
      .catch((err) => {
        console.error('Failed to load master password:', err);
      })
      .finally(() => {
        if (isMounted) setMasterLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync section access codes if codes change in another tab
  useEffect(() => {
    const refresh = () => {
      const next = {} as Record<AccessCodeKey, string>;
      for (const k of codeKeys) next[k] = getAccessCode(k);
      setDrafts(next);
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [codeKeys]);

  const handleSaveMasterPassword = async () => {
    if (!hasAccess) {
      onToast?.({ message: 'Only Admin can update access codes.', type: 'error' });
      return;
    }
    const val = masterPassword.trim();
    if (val.length < 4) {
      onToast?.({ message: 'Master password must be at least 4 characters.', type: 'error' });
      return;
    }
    setMasterSaving(true);
    try {
      await updateAccessCodesMasterPassword(val);
      onToast?.({ message: 'Access codes master password updated successfully.', type: 'success' });
    } catch (err: any) {
      onToast?.({ message: err?.message || 'Failed to update master password.', type: 'error' });
    } finally {
      setMasterSaving(false);
    }
  };

  const handleResetMasterPassword = async () => {
    if (!hasAccess) {
      onToast?.({ message: 'Only Admin can reset access codes.', type: 'error' });
      return;
    }
    setMasterSaving(true);
    try {
      await resetAccessCodesMasterPassword();
      setMasterPassword(DEFAULT_MASTER_PASSWORD);
      onToast?.({ message: 'Master password reset to default (Welcome@123).', type: 'success' });
    } catch (err: any) {
      onToast?.({ message: err?.message || 'Failed to reset master password.', type: 'error' });
    } finally {
      setMasterSaving(false);
    }
  };

  const handleSave = (key: AccessCodeKey) => {
    if (!hasAccess) {
      onToast?.({ message: 'Only Admin can update access codes.', type: 'error' });
      return;
    }
    const value = drafts[key].trim();
    if (value.length < 4) {
      onToast?.({ message: 'Access codes must be at least 4 characters.', type: 'error' });
      return;
    }
    setAccessCode(key, value);
    onToast?.({ message: `${ACCESS_CODE_LABELS[key]} access code updated.`, type: 'success' });
  };

  const handleReset = (key: AccessCodeKey) => {
    if (!hasAccess) {
      onToast?.({ message: 'Only Admin can reset access codes.', type: 'error' });
      return;
    }
    resetAccessCode(key);
    setDrafts((prev) => ({ ...prev, [key]: DEFAULT_ACCESS_CODES[key] }));
    onToast?.({ message: `${ACCESS_CODE_LABELS[key]} reset to default.`, type: 'success' });
  };

  const handleLock = () => {
    lockProtectedSection('access_codes');
    onToast?.({ message: 'Access codes section locked.', type: 'success' });
  };

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Access Codes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Codes required to unlock protected sections like Medical Records and Agency Financials.
          </p>
        </div>
        <Card className="p-8 text-center border-dashed border-2 border-rose-200 dark:border-rose-900/30">
          <i className="ri-lock-2-line text-4xl text-rose-500 mb-3 block"></i>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">Access Restricted</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Only users with the <strong>Admin</strong> role can view or modify access codes.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Access Codes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Codes required to unlock protected sections like Medical Records and Agency Financials. Changes apply immediately to any open window.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleLock}
          className="self-start sm:self-auto text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 border-gray-300 dark:border-white/10"
        >
          <i className="ri-lock-2-line mr-1.5"></i> Lock Section
        </Button>
      </div>

      <Card className="border border-amber-100 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-900/30 p-4">
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          <i className="ri-information-line mr-1"></i>
          These codes are an extra confirmation step — they do <strong>not</strong> replace Supabase Row-Level Security. Share them only with authorized agency staff.
        </p>
      </Card>

      {/* ─── MASTER ACCESS CODES PASSWORD CARD ──────────────────────────── */}
      <Card className="p-5 border-2 border-rose-200/80 dark:border-rose-900/40 bg-gradient-to-br from-rose-50/50 via-white to-rose-50/20 dark:from-[#1b1429] dark:via-[#15111f] dark:to-[#1a1226] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                Access Codes Section Password
              </h4>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40">
                Master Password
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Required to unlock this <strong>Access Codes</strong> configuration page. Default:{' '}
              <code className="font-mono bg-white/80 dark:bg-black/30 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10 font-semibold text-rose-600 dark:text-rose-400">
                {DEFAULT_MASTER_PASSWORD}
              </code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMasterRevealed((p) => !p)}
            className="text-xs font-semibold text-rose-500 hover:text-rose-700 self-start sm:self-auto cursor-pointer"
          >
            {masterRevealed ? (
              <>
                <i className="ri-eye-off-line mr-1"></i>Hide
              </>
            ) : (
              <>
                <i className="ri-eye-line mr-1"></i>Show
              </>
            )}
          </button>
        </div>

        <div className="space-y-3">
          <input
            type={masterRevealed ? 'text' : 'password'}
            className="w-full px-4 py-2.5 rounded-lg border border-rose-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/40 font-mono text-sm"
            value={masterPassword}
            disabled={masterLoading || masterSaving}
            onChange={(e) => setMasterPassword(e.target.value)}
            placeholder={masterLoading ? 'Loading password...' : 'Enter master password...'}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={masterSaving || masterLoading}
              onClick={handleSaveMasterPassword}
              className="bg-gradient-to-r from-rose-500 to-indigo-600 shadow-md shadow-rose-500/20"
            >
              <i className="ri-save-line mr-1"></i>
              {masterSaving ? 'Saving...' : 'Save Password'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={masterSaving || masterLoading}
              onClick={handleResetMasterPassword}
            >
              <i className="ri-refresh-line mr-1"></i> Reset to default
            </Button>
          </div>
        </div>
      </Card>

      {/* ─── INDIVIDUAL PROTECTED SECTIONS ──────────────────────────────── */}
      <div className="pt-2">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
          Protected Section Access Codes
        </h4>
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
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  {revealed[key] ? (
                    <>
                      <i className="ri-eye-off-line mr-1"></i>Hide
                    </>
                  ) : (
                    <>
                      <i className="ri-eye-line mr-1"></i>Show
                    </>
                  )}
                </button>
              </div>
              <input
                type={revealed[key] ? 'text' : 'password'}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0e0b1a] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/40 font-mono text-sm"
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
    </div>
  );
};

export default AccessCodesSection;
