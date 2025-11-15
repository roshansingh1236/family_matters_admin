
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../base/Button';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { user, logout, initializing, profile, profileLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = useMemo(() => {
    if (profile && typeof profile === 'object') {
      const profileFirstName = (profile.firstName as string | undefined)?.trim();
      const profileLastName = (profile.lastName as string | undefined)?.trim();
      const combined = [profileFirstName, profileLastName].filter(Boolean).join(' ');
      if (combined.length > 0) {
        return combined;
      }

      const nestedFirstName = (profile.formData as Record<string, unknown> | undefined)?.firstName as string | undefined;
      const nestedLastName = (profile.formData as Record<string, unknown> | undefined)?.lastName as string | undefined;
      const nestedCombined = [nestedFirstName, nestedLastName].filter(Boolean).join(' ');
      if (nestedCombined.length > 0) {
        return nestedCombined;
      }

      const parent1Name = (profile.parent1 as Record<string, unknown> | undefined)?.name as string | undefined;
      if (parent1Name && parent1Name.trim().length > 0) {
        return parent1Name.trim();
      }
    }

    if (user?.displayName && user.displayName.trim().length > 0) {
      return user.displayName;
    }

    if (user?.email) {
      const [localPart] = user.email.split('@');
      return localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }

    return 'Administrator';
  }, [user]);

  const roleLabel = useMemo(() => {
    if (profile && typeof profile === 'object') {
      const role = profile.role as string | undefined;
      if (role) return role;
    }
    return 'Signed in user';
  }, [profile]);

  const emailText = useMemo(() => {
    if (profileLoading) return '';
    if (profile && typeof profile === 'object') {
      return (profile.email as string | undefined) ?? user?.email ?? 'Signed in user';
    }
    return user?.email ?? 'Signed in user';
  }, [profile, profileLoading, user]);

  const subtitle = useMemo(() => {
    if (initializing || profileLoading) return '';
    const parts = [roleLabel, emailText].filter((part) => part && part.length > 0);
    return parts.join(' • ');
  }, [emailText, initializing, profileLoading, roleLabel]);

  const avatarInitials = useMemo(() => {
    const source = displayName || emailText || 'FM';
    const initials = source
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2);

    if (initials.length > 0) {
      return initials;
    }

    return 'FM';
  }, [displayName, emailText]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Failed to log out', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <i className="ri-menu-line text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          )}
          
          <div className="hidden sm:block">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Family Matters Admin
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Surrogacy Program Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <i className="ri-sun-line text-xl text-yellow-500"></i>
            ) : (
              <i className="ri-moon-line text-xl text-gray-600"></i>
            )}
          </button>

          {/* Notifications */}
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative">
            <i className="ri-notification-line text-xl text-gray-600 dark:text-gray-300"></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {initializing || profileLoading ? 'Loading...' : displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {initializing || profileLoading ? '' : subtitle}
              </p>
            </div>
            
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">{avatarInitials}</span>
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-600"
            >
              <i className="ri-logout-box-line text-sm"></i>
              <span className="hidden lg:inline">Logout</span>
            </Button>

            {/* Mobile Logout */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Logout"
            >
              <i className="ri-logout-box-line text-xl text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400"></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
