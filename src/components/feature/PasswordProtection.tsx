import React, { useState, useEffect } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import {
  ACCESS_CODE_STORAGE_KEY,
  DEFAULT_ACCESS_CODES,
  getStoredAccessCodes,
  type AccessCodeKey
} from '../../utils/accessCodes';

interface PasswordProtectionProps {
  children: React.ReactNode;
  menuName: string;
}

const PasswordProtection: React.FC<PasswordProtectionProps> = ({ children, menuName }) => {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState<string>(() => {
    const stored = getStoredAccessCodes();
    const key = menuName.toLowerCase() as AccessCodeKey;
    return stored[key] ?? DEFAULT_ACCESS_CODES[key] ?? 'admin123';
  });

  // Per client review: access codes are now configurable from Settings.
  // Refresh when the saved codes change.
  useEffect(() => {
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
  }, [menuName]);

  useEffect(() => {
    // Check if recently unlocked (valid for 30 minutes)
    const lastUnlock = localStorage.getItem(`unlocked_${menuName}`);
    if (lastUnlock) {
      const unlockTime = parseInt(lastUnlock, 10);
      const now = Date.now();
      if (now - unlockTime < 30 * 60 * 1000) {
        setIsUnlocked(true);
      }
    }
  }, [menuName]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-[#0e0b1a] min-h-[60vh]">
      <Card className="max-w-md w-full p-8 text-center shadow-xl border-rose-100/50 dark:border-white/5">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6">
          <i className="ri-lock-2-line text-3xl"></i>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 capitalize">
          {menuName} Protected
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          This section contains sensitive information. Please enter the access code to continue.
          {' '}Codes can be changed in <strong>Settings → Access Codes</strong>.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
              Access Code
            </label>
            <input
              type="password"
              autoFocus
              className="w-full bg-rose-50/30 dark:bg-white/5 border border-rose-100 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 transition-all outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-xs text-red-500 mt-2 ml-1">{error}</p>}
          </div>

          <Button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 shadow-lg shadow-rose-500/20"
          >
            Unlock Section
          </Button>
        </form>

        <p className="mt-8 text-[10px] text-gray-400 font-medium">
          Authorized personnel only. Access attempts are logged.
        </p>
      </Card>
    </div>
  );
};

export default PasswordProtection;
