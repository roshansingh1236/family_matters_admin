import React, { useState, useEffect } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import {
  ACCESS_CODE_STORAGE_KEY,
  DEFAULT_ACCESS_CODES,
  getStoredAccessCodes,
  type AccessCodeKey
} from '../../utils/accessCodes';

export interface PasswordProtectionProps {
  children: React.ReactNode;
  menuName: string;
  verifyFn?: (password: string) => Promise<boolean>;
  title?: string;
  description?: React.ReactNode;
  variant?: 'page' | 'inline';
}

/**
 * Triggers re-locking of any currently unlocked section by menuName.
 */
export function lockProtectedSection(menuName: string): void {
  try {
    localStorage.removeItem(`unlocked_${menuName}`);
    window.dispatchEvent(
      new CustomEvent('fm_lock_section', { detail: { menuName } })
    );
  } catch (err) {
    console.error('Error locking section:', err);
  }
}

const PasswordProtection: React.FC<PasswordProtectionProps> = ({
  children,
  menuName,
  verifyFn,
  title,
  description,
  variant = 'page'
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState<string>(() => {
    const stored = getStoredAccessCodes();
    const key = menuName.toLowerCase() as AccessCodeKey;
    return stored[key] ?? DEFAULT_ACCESS_CODES[key] ?? 'admin123';
  });

  // Refresh when stored access codes change (for standard menu items)
  useEffect(() => {
    if (verifyFn) return;
    const refresh = () => {
      const stored = getStoredAccessCodes();
      const key = menuName.toLowerCase() as AccessCodeKey;
      setCurrentPassword(stored[key] ?? DEFAULT_ACCESS_CODES[key] ?? 'admin123');
    };
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACCESS_CODE_STORAGE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [menuName, verifyFn]);

  // Check if recently unlocked (valid for 30 minutes)
  useEffect(() => {
    const lastUnlock = localStorage.getItem(`unlocked_${menuName}`);
    if (lastUnlock) {
      const unlockTime = parseInt(lastUnlock, 10);
      const now = Date.now();
      if (now - unlockTime < 30 * 60 * 1000) {
        setIsUnlocked(true);
      }
    }
  }, [menuName]);

  // Listen for programmatic lock events
  useEffect(() => {
    const handleLock = (e: Event) => {
      const customEvent = e as CustomEvent<{ menuName: string }>;
      if (customEvent.detail?.menuName === menuName) {
        setIsUnlocked(false);
        setPassword('');
        setError('');
      }
    };
    window.addEventListener('fm_lock_section', handleLock as EventListener);
    return () => window.removeEventListener('fm_lock_section', handleLock as EventListener);
  }, [menuName]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = password.trim();
    if (!trimmed) {
      setError('Please enter the password / access code.');
      return;
    }

    if (verifyFn) {
      setLoading(true);
      try {
        const isValid = await verifyFn(trimmed);
        if (isValid) {
          setIsUnlocked(true);
          setError('');
          localStorage.setItem(`unlocked_${menuName}`, Date.now().toString());
        } else {
          setError('Invalid password. Please try again.');
        }
      } catch (err: any) {
        setError(err?.message || 'Verification failed. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Default synchronous local verification for standard access codes
    if (password === currentPassword) {
      setIsUnlocked(true);
      setError('');
      localStorage.setItem(`unlocked_${menuName}`, Date.now().toString());
    } else {
      setError('Invalid access code. Please try again.');
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  const content = (
    <div className="max-w-md w-full p-8 text-center rounded-2xl bg-white dark:bg-[#15111f] border border-rose-100/60 dark:border-white/10 shadow-xl">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6">
        <i className="ri-lock-2-line text-3xl"></i>
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 capitalize">
        {title || `${menuName} Protected`}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
        {description || (
          <>
            This section contains sensitive information. Please enter the access code to continue.
            {' '}Codes can be changed in <strong>Settings → Access Codes</strong>.
          </>
        )}
      </p>

      <form onSubmit={handleUnlock} className="space-y-4 text-left">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
            {verifyFn ? 'Security Password' : 'Access Code'}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              disabled={loading}
              className="w-full bg-rose-50/30 dark:bg-white/5 border border-rose-100 dark:border-white/10 rounded-xl px-4 py-3 pr-11 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1"
              title={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              <i className={showPassword ? 'ri-eye-off-line text-lg' : 'ri-eye-line text-lg'}></i>
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2 ml-1 leading-snug">{error}</p>}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 shadow-lg shadow-rose-500/20 disabled:opacity-70"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <i className="ri-loader-4-line animate-spin"></i>
              <span>Verifying...</span>
            </span>
          ) : (
            'Unlock Section'
          )}
        </Button>
      </form>

      <p className="mt-8 text-[10px] text-gray-400 font-medium">
        Authorized personnel only. Access attempts are logged.
      </p>
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="py-6 px-2 flex justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-[#0e0b1a] min-h-[60vh]">
      <Card className="max-w-md w-full p-0 border-none shadow-none bg-transparent">
        {content}
      </Card>
    </div>
  );
};

export default PasswordProtection;