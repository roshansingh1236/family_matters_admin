
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sidebarItems: SidebarItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line', path: '/' },
    { id: 'requests', label: 'New Requests', icon: 'ri-file-list-3-line', path: '/requests', badge: 12 },
    { id: 'surrogates', label: 'Surrogates', icon: 'ri-user-heart-line', path: '/surrogates' },
    { id: 'parents', label: 'Intended Parents', icon: 'ri-parent-line', path: '/parents' },
    { id: 'matches', label: 'Matches', icon: 'ri-links-line', path: '/matches' },
    { id: 'contracts', label: 'Contracts', icon: 'ri-file-text-line', path: '/contracts' },
    { id: 'medical', label: 'Medical Records', icon: 'ri-health-book-line', path: '/medical' },
    { id: 'payments', label: 'Payments', icon: 'ri-money-dollar-circle-line', path: '/payments' },
    { id: 'calendar', label: 'Calendar', icon: 'ri-calendar-line', path: '/calendar' },
    { id: 'reports', label: 'Reports', icon: 'ri-bar-chart-line', path: '/reports' },
    { id: 'settings', label: 'Settings', icon: 'ri-settings-3-line', path: '/settings' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <i className="ri-heart-3-fill text-white text-lg"></i>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: '"Pacifico", serif' }}>
                Family Matters
              </h1>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <i className={`ri-menu-${isCollapsed ? 'unfold' : 'fold'}-line text-gray-600 dark:text-gray-300`}></i>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        <ul className="space-y-2">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-r-2 border-blue-600'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${item.icon} text-lg`}></i>
                  </div>
                  {!isCollapsed && (
                    <>
                      <span className="font-medium flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
