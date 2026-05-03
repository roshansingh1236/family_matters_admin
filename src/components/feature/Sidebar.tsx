import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type MenuItem = {
  type?: never;
  icon: string;
  label: string;
  path: string;
};

type DividerItem = {
  type: 'divider';
  label: string;
  icon?: never;
  path?: never;
};

type NavItem = MenuItem | DividerItem;

const menuItems: NavItem[] = [
  { type: 'divider', label: 'Core' },
  { icon: 'ri-dashboard-3-line',         label: 'Dashboard',         path: '/' },
  { icon: 'ri-parent-line',              label: 'Parents',           path: '/parents' },
  { icon: 'ri-user-heart-line',          label: 'Surrogates',        path: '/surrogates' },
  { icon: 'ri-links-line',               label: 'Matches',           path: '/matches' },
  { icon: 'ri-route-line',               label: 'Journeys',          path: '/journeys' },
  { icon: 'ri-question-answer-line',     label: 'Online Inquiries',  path: '/inquiries?source=online' },
  { icon: 'ri-phone-line',               label: 'Phone Inquiries',   path: '/inquiries?source=phone' },

  { type: 'divider', label: 'Operations' },
  { icon: 'ri-task-line',                label: 'Tasks',             path: '/tasks' },
  { icon: 'ri-calendar-event-line',      label: 'Calendar',          path: '/calendar' },
  { icon: 'ri-time-line',                label: 'Appointments',      path: '/appointments' },
  { icon: 'ri-heart-pulse-line',         label: 'Baby Watch',        path: '/baby-watch' },
  { icon: 'ri-hospital-line',            label: 'Medical',           path: '/medical' },
  { icon: 'ri-stethoscope-line',         label: 'Screening',         path: '/screening' },
  { icon: 'ri-advertisement-line',       label: 'Marketing Assets',  path: '/marketing' },

  { type: 'divider', label: 'Finance & Legal' },
  { icon: 'ri-money-dollar-circle-line', label: 'Compensation',      path: '/payments' },
  { icon: 'ri-bank-card-line',           label: 'Agency Financials', path: '/financials' },
  { icon: 'ri-file-text-line',           label: 'Contracts',         path: '/contracts' },

  { type: 'divider', label: 'Communicate' },
  { icon: 'ri-contacts-book-line',       label: 'Contacts',          path: '/contacts' },
  { icon: 'ri-message-3-line',           label: 'Messages',          path: '/messages' },
  { icon: 'ri-file-chart-line',          label: 'Reports',           path: '/reports' },
  { icon: 'ri-shield-check-line',        label: 'Audit Log',         path: '/audit' },
  { icon: 'ri-settings-4-line',          label: 'Settings',          path: '/settings' },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const displayName: string = (() => {
    if (profile && typeof profile === 'object') {
      const p = profile as Record<string, unknown>;
      const first = (p.firstName ?? p.first_name ?? '') as string;
      const last  = (p.lastName  ?? p.last_name  ?? '') as string;
      const combined = [first, last].filter(Boolean).join(' ').trim();
      if (combined) return combined;
      if (typeof p.email === 'string') return p.email.split('@')[0];
    }
    return 'Administrator';
  })();

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p: string) => p[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'FM';

  const handleSignOut = async () => {
    try { await logout(); navigate('/auth/login'); }
    catch (e) { console.error('Error signing out:', e); }
  };

  return (
    <aside
      className={`
        relative flex flex-col h-full flex-shrink-0 transition-all duration-300
        bg-white dark:bg-[#0e0b1a]
        border-r border-rose-100/70 dark:border-white/5
        ${collapsed ? 'w-[68px]' : 'w-64'}
      `}
    >
      {/* Top gradient accent strip */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 z-10" />

      {/* Logo area */}
      <div className={`flex items-center gap-3 px-4 pt-6 pb-5 ${collapsed ? 'justify-center' : ''}`}>
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <i className="ri-heart-line text-white text-[17px]"></i>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-[#0e0b1a]"></span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-none tracking-tight">Family Matters</p>
            <p className="text-[10px] font-semibold mt-0.5 tracking-widest uppercase bg-gradient-to-r from-rose-500 to-purple-500 bg-clip-text text-transparent">
              Admin Panel
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5 transition-colors"
          >
            <i className="ri-menu-fold-line text-base"></i>
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-7 z-20 w-6 h-6 bg-white dark:bg-[#1a1530] border border-rose-200 dark:border-white/10 rounded-full flex items-center justify-center shadow-md text-rose-400 hover:text-rose-600 transition-colors"
          >
            <i className="ri-arrow-right-s-line text-sm"></i>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {menuItems.map((item, index) => {
          if (item.type === 'divider') {
            return (
              <div key={index} className={`pt-5 pb-1.5 ${collapsed ? 'hidden' : ''}`}>
                <p className="px-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-600">
                  {item.label}
                </p>
              </div>
            );
          }

          const isActive = item.path === '/'
            ? location.pathname === '/'
            : (location.pathname + location.search).startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`
                group relative flex items-center gap-3 rounded-xl transition-all duration-200 mb-0.5
                ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                ${isActive
                  ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white shadow-lg shadow-rose-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-rose-50 dark:hover:bg-white/5 hover:text-rose-600 dark:hover:text-rose-400'
                }
              `}
            >
              <i className={`${item.icon} text-[17px] flex-shrink-0`}></i>
              {!collapsed && (
                <span className="text-sm font-medium flex-1 min-w-0 truncate leading-none">
                  {item.label}
                </span>
              )}
              {/* Tooltip in collapsed mode */}
              {collapsed && (
                <div className="
                  absolute left-full ml-3 px-2.5 py-1.5
                  bg-gray-900 dark:bg-[#1a1530] border border-white/10
                  text-white text-xs font-medium rounded-lg
                  opacity-0 group-hover:opacity-100 pointer-events-none
                  whitespace-nowrap z-50 shadow-xl
                  transition-all duration-150 translate-x-1 group-hover:translate-x-0
                ">
                  {item.label}
                  <span className="absolute top-1/2 -left-[5px] -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-[#1a1530]"></span>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User card */}
      <div className={`p-3 border-t border-rose-100/60 dark:border-white/5 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="group relative p-2.5 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5 transition-colors"
          >
            <i className="ri-logout-box-line text-lg"></i>
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl">
              Sign Out
            </div>
          </button>
        ) : (
          <div className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50/70 dark:hover:bg-white/5 transition-colors cursor-default">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold shadow-md shadow-rose-500/20">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-none">{displayName}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Administrator</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
              title="Sign Out"
            >
              <i className="ri-logout-box-line text-sm"></i>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
