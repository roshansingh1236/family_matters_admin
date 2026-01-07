import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'inquiry' | 'request';
  name: string;
  time: string;
  isRead: boolean;
  source: 'online' | 'phone';
}

interface NotificationDropdownProps {
  onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch recent 5 users (inquiries or requests)
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        const role = data.role || 'inquiry';
        const type: 'inquiry' | 'request' = role === 'inquiry' ? 'inquiry' : 'request';
        
        // Calculate relative time roughly
        let timeStr = 'Just now';
        if (data.createdAt instanceof Timestamp) {
            const diffInSeconds = (Timestamp.now().seconds - data.createdAt.seconds);
            if (diffInSeconds < 60) timeStr = 'Just now';
            else if (diffInSeconds < 3600) timeStr = `${Math.floor(diffInSeconds / 60)}m ago`;
            else if (diffInSeconds < 86400) timeStr = `${Math.floor(diffInSeconds / 3600)}h ago`;
            else timeStr = `${Math.floor(diffInSeconds / 86400)}d ago`;
        }

        const name = data.displayName || data.firstName || data.email || 'New User';

        return {
          id: doc.id,
          type,
          name,
          time: timeStr,
          isRead: false, // We don't have a read status yet, so standardizing
          source: data.source as 'online' | 'phone' || 'online'
        };
      });
      setNotifications(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleItemClick = (notification: Notification) => {
    // Navigate based on type
    if (notification.type === 'request') {
      navigate('/requests');
    } else {
      navigate('/inquiries');
    }
    onClose();
  };

  return (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
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
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
              >
                <div className="flex gap-3">
                  <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    item.type === 'request' 
                      ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' 
                      : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    <i className={item.type === 'request' ? 'ri-file-list-3-line' : 'ri-question-line'}></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.type === 'request' ? 'New Request received' : 'New Inquiry received'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      From <span className="font-medium">{item.name}</span> ({item.source})
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

      <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-center">
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
