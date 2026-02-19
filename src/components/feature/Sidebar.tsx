
import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { icon: 'ri-dashboard-line', label: 'Dashboard', path: '/' },
    { icon: 'ri-parent-line', label: 'Parents', path: '/parents' },
    { icon: 'ri-user-heart-line', label: 'Surrogates', path: '/surrogates' },
    { icon: 'ri-links-line', label: 'Matches', path: '/matches' },
    { icon: 'ri-question-answer-line', label: 'Inquiries', path: '/inquiries' },
    { icon: 'ri-file-text-line', label: 'Contracts', path: '/contracts' },
    { type: 'divider' },
    { icon: 'ri-task-line', label: 'Tasks', path: '/tasks' },
    { icon: 'ri-calendar-line', label: 'Calendar', path: '/calendar' },
    { icon: 'ri-time-line', label: 'Appointments', path: '/appointments' },
    { icon: 'ri-heart-pulse-line', label: 'Baby Watch', path: '/baby-watch' },
    { icon: 'ri-hospital-line', label: 'Medical', path: '/medical' },
    { icon: 'ri-stethoscope-line', label: 'Screening', path: '/screening' },
    { icon: 'ri-money-dollar-circle-line', label: 'Compensation', path: '/payments' },
    { icon: 'ri-bank-card-line', label: 'Agency Financials', path: '/financials' },
    { type: 'divider' },
    { icon: 'ri-message-3-line', label: 'Messages', path: '/messages' },
    { icon: 'ri-roadmap-line', label: 'Journeys', path: '/journeys' },
    { icon: 'ri-file-chart-line', label: 'Reports', path: '/reports' },
    { icon: 'ri-settings-4-line', label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full flex-shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
          FM
        </div>
        <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">Family Matters</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
        {menuItems.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="my-4 border-t border-gray-100 dark:border-gray-700" />;
          }

          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path || '');

          return (
            <NavLink
              key={item.path}
              to={item.path!}
              className={({ isActive: linkActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                ${isActive || linkActive
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <i className={`${item.icon} text-lg ${isActive ? 'text-rose-500 dark:text-rose-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}></i>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
        >
          <i className="ri-logout-box-line text-lg"></i>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
