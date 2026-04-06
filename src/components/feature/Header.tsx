import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const PAGE_TITLES: Record<string, { label: string; icon: string }> = {
  '/':            { label: 'Dashboard',         icon: 'ri-dashboard-3-line' },
  '/parents':     { label: 'Parents',           icon: 'ri-parent-line' },
  '/surrogates':  { label: 'Surrogates',        icon: 'ri-user-heart-line' },
  '/matches':     { label: 'Matches',           icon: 'ri-links-line' },
  '/journeys':    { label: 'Journeys',          icon: 'ri-route-line' },
  '/inquiries':   { label: 'Inquiries',         icon: 'ri-question-answer-line' },
  '/tasks':       { label: 'Tasks',             icon: 'ri-task-line' },
  '/calendar':    { label: 'Calendar',          icon: 'ri-calendar-event-line' },
  '/appointments':{ label: 'Appointments',      icon: 'ri-time-line' },
  '/baby-watch':  { label: 'Baby Watch',        icon: 'ri-heart-pulse-line' },
  '/medical':     { label: 'Medical',           icon: 'ri-hospital-line' },
  '/screening':   { label: 'Screening',         icon: 'ri-stethoscope-line' },
  '/payments':    { label: 'Compensation',      icon: 'ri-money-dollar-circle-line' },
  '/financials':  { label: 'Agency Financials', icon: 'ri-bank-card-line' },
  '/contracts':   { label: 'Contracts',         icon: 'ri-file-text-line' },
  '/messages':    { label: 'Messages',          icon: 'ri-message-3-line' },
  '/reports':     { label: 'Reports',           icon: 'ri-file-chart-line' },
  '/settings':    { label: 'Settings',          icon: 'ri-settings-4-line' },
};

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, initializing, profile, profileLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notificationRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node))
        setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentPage = useMemo(() => {
    const exact = PAGE_TITLES[location.pathname];
    if (exact) return exact;
    const prefix = Object.keys(PAGE_TITLES)
      .filter(k => k !== '/')
      .find(k => location.pathname.startsWith(k));
    return prefix ? PAGE_TITLES[prefix] : { label: 'Family Matters', icon: 'ri-heart-line' };
  }, [location.pathname]);

  const displayName = useMemo(() => {
    if (profile && typeof profile === 'object') {
      const p = profile as Record<string, unknown>;
      const first = ((p.firstName ?? p.first_name) as string | undefined)?.trim() ?? '';
      const last  = ((p.lastName  ?? p.last_name)  as string | undefined)?.trim() ?? '';
      const combined = [first, last].filter(Boolean).join(' ');
      if (combined) return combined;
      const formData = p.formData as Record<string, unknown> | undefined;
      const fFirst = (formData?.firstName as string | undefined)?.trim() ?? '';
      const fLast  = (formData?.lastName  as string | undefined)?.trim() ?? '';
      const fCombined = [fFirst, fLast].filter(Boolean).join(' ');
      if (fCombined) return fCombined;
    }
    if (user?.displayName?.trim()) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'Administrator';
  }, [user, profile]);

  const emailText = useMemo(() => {
    if (profileLoading) return '';
    if (profile && typeof profile === 'object')
      return ((profile as any).email as string | undefined) ?? user?.email ?? '';
    return user?.email ?? '';
  }, [profile, profileLoading, user]);

  const avatarInitials = useMemo(() => {
    const src = displayName || emailText || 'FM';
    return src.split(' ').filter(Boolean).map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'FM';
  }, [displayName, emailText]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try { await logout(); navigate('/auth/login'); }
    catch (e) { console.error('Failed to log out', e); }
    finally { setIsLoggingOut(false); }
  };

  return (
    <header className="relative bg-white dark:bg-[#0e0b1a] border-b border-rose-100/70 dark:border-white/5 px-5 py-3 flex-shrink-0">
      {/* Subtle gradient line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rose-200/60 dark:via-rose-500/10 to-transparent" />

      <div className="flex items-center gap-4">

        {/* Mobile menu toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <i className="ri-menu-line text-xl"></i>
          </button>
        )}

        {/* Page title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/10 to-purple-500/10 dark:from-rose-500/20 dark:to-purple-500/20 flex items-center justify-center flex-shrink-0">
            <i className={`${currentPage.icon} text-base bg-gradient-to-br from-rose-500 to-purple-600 bg-clip-text text-transparent`}
               style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg, #f43f5e, #a855f7)' }}
            ></i>
          </div>
          <div className="hidden sm:block min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-none">{currentPage.label}</h1>
            <p className="text-[10px] text-gray-400 mt-0.5">Family Matters Admin</p>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-1">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`
              relative p-2 rounded-xl transition-all duration-200 text-sm font-medium
              ${isDark
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }
            `}
          >
            <i className={`text-lg ${isDark ? 'ri-sun-line' : 'ri-moon-line'}`}></i>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(v => !v)}
              className={`
                relative p-2 rounded-xl transition-all duration-200
                ${showNotifications
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-rose-500'
                }
              `}
            >
              <i className={`text-lg ${showNotifications ? 'ri-notification-fill' : 'ri-notification-line'}`}></i>
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-[#0e0b1a] animate-pulse-soft"></span>
            </button>
            {showNotifications && (
              <NotificationDropdown onClose={() => setShowNotifications(false)} />
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-rose-50 dark:hover:bg-white/5 transition-colors group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shadow-md shadow-rose-500/20 flex-shrink-0">
                {avatarInitials}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-none">
                  {initializing || profileLoading ? '...' : displayName}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]">
                  {emailText || 'Administrator'}
                </p>
              </div>
              <i className={`ri-arrow-down-s-line text-sm text-gray-400 transition-transform duration-200 hidden md:block ${showUserMenu ? 'rotate-180' : ''}`}></i>
            </button>

            {/* User dropdown */}
            {showUserMenu && (
              <div className="
                absolute right-0 top-full mt-2 w-56
                bg-white dark:bg-[#1a1530]
                border border-rose-100 dark:border-white/10
                rounded-2xl shadow-xl shadow-rose-500/10 dark:shadow-black/40
                overflow-hidden z-50 animate-fade-in
              ">
                {/* User info */}
                <div className="px-4 py-3 bg-gradient-to-br from-rose-50 to-purple-50 dark:from-rose-500/5 dark:to-purple-500/5 border-b border-rose-100/60 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md shadow-rose-500/20">
                      {avatarInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{emailText || 'Administrator'}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-2">
                  <button
                    onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-white/5 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  >
                    <i className="ri-settings-4-line text-base"></i> Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <i className="ri-logout-box-line text-base"></i>
                    {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
