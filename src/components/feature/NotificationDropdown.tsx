import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'inquiry' | 'request';
  name: string;
  time: string;
  isRead: boolean;
}

interface NotificationDropdownProps {
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diffInSeconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setNotifications(
          data.map((row) => {
            const role = row.role ?? '';
            const type: 'inquiry' | 'request' = role === 'inquiry' ? 'inquiry' : 'request';
            const name =
              [row.first_name, row.last_name].filter(Boolean).join(' ') ||
              row.email ||
              'New User';
            return {
              id: row.id,
              type,
              name,
              time: row.created_at ? timeAgo(row.created_at) : 'Just now',
              isRead: false,
            };
          })
        );
      }
      setLoading(false);
    };

    fetchRecent();

    // Real-time subscription for new users
    const channel = supabase
      .channel('users-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => {
        fetchRecent();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleItemClick = (notification: Notification) => {
    if (notification.type === 'request') {
      navigate('/requests');
    } else {
      navigate('/inquiries');
    }
    onClose();
  };

  return (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-[#15111f] rounded-lg shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
      <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
          {notifications.length} New
        </span>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            <i className="ri-notification-off-line text-2xl mb-2 block text-gray-400"></i>
            No new notifications
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="p-4 hover:bg-gray-50 dark:hover:bg-white/5/50 cursor-pointer transition-colors group"
              >
                <div className="flex gap-3">
                  <div
                    className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      item.type === 'request'
                        ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  >
                    <i className={item.type === 'request' ? 'ri-file-list-3-line' : 'ri-question-line'}></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.type === 'request' ? 'New Request received' : 'New Inquiry received'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      From <span className="font-medium">{item.name}</span>
                    </p>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">
                      {item.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0e0b1a]/50 text-center">
        <button
          onClick={onClose}
          className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Close Notifications
        </button>
      </div>
    </div>
  );
};

export default NotificationDropdown;
