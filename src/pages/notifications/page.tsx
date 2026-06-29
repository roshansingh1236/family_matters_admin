import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';

interface Notification {
  id: string;
  type: 'ip_inquiry' | 'surrogate_inquiry' | 'appointment' | 'system_alert';
  title: string;
  name: string;
  time: string;
  rawTime: string;
  isRead: boolean;
}

function timeAgo(dateStr: string): string {
  const diffInSeconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [usersRes, gcRes, apptsRes, notifRes] = await Promise.all([
          supabase
            .from('users')
            .select('id, first_name, last_name, email, role, created_at')
            .eq('role', 'Intended Parent')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('surrogate_inquiries')
            .select('id, first_name, last_name, name, email, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('appointments')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.auth.getUser().then(({ data }) => {
            if (!data.user) return { data: null };
            return supabase
              .from('notifications')
              .select('*')
              .eq('user_id', data.user.id)
              .order('created_at', { ascending: false })
              .limit(50);
          })
        ]);

        const list: Notification[] = [];

        if (usersRes.data) {
          usersRes.data.forEach((row) => {
            const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'New Intended Parent';
            list.push({
              id: `ip-${row.id}`,
              type: 'ip_inquiry',
              title: 'New IP Inquiry',
              name,
              time: row.created_at ? timeAgo(row.created_at) : 'Just now',
              rawTime: row.created_at || '',
              isRead: false,
            });
          });
        }

        if (gcRes.data) {
          gcRes.data.forEach((row) => {
            const name = row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'New Surrogate Lead';
            list.push({
              id: `gc-${row.id}`,
              type: 'surrogate_inquiry',
              title: 'New Surrogate Inquiry',
              name,
              time: row.created_at ? timeAgo(row.created_at) : 'Just now',
              rawTime: row.created_at || '',
              isRead: false,
            });
          });
        }

        if (apptsRes.data) {
          apptsRes.data.forEach((row) => {
            list.push({
              id: `apt-${row.id}`,
              type: 'appointment',
              title: 'New Event Scheduled',
              name: row.title || 'Meeting',
              time: row.created_at ? timeAgo(row.created_at) : 'Just now',
              rawTime: row.created_at || '',
              isRead: false,
            });
          });
        }

        if (notifRes && notifRes.data) {
          notifRes.data.forEach((row: any) => {
            list.push({
              id: `sys-${row.id}`,
              type: 'system_alert',
              title: row.title || 'System Alert',
              name: row.message || '',
              time: row.created_at ? timeAgo(row.created_at) : 'Just now',
              rawTime: row.created_at || '',
              isRead: row.is_read || false,
            });
          });
        }

        list.sort((a, b) => b.rawTime.localeCompare(a.rawTime));
        setNotifications(list);
      } catch (err) {
        console.error('Failed to load notifications', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    const channelUsers = supabase
      .channel('users-notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => {
        fetchAll();
      })
      .subscribe();

    const channelSurr = supabase
      .channel('surrogate-notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surrogate_inquiries' }, () => {
        fetchAll();
      })
      .subscribe();

    const channelAppts = supabase
      .channel('appointments-notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, () => {
        fetchAll();
      })
      .subscribe();

    const channelSys = supabase
      .channel('sys-notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelUsers);
      supabase.removeChannel(channelSurr);
      supabase.removeChannel(channelAppts);
      supabase.removeChannel(channelSys);
    };
  }, []);

  const handleItemClick = (notification: Notification) => {
    if (notification.type === 'appointment') {
      navigate('/appointments');
    } else if (notification.type === 'system_alert') {
      navigate('/matches');
    } else {
      navigate('/inquiries');
    }
  };

  const getNotificationStyles = (type: Notification['type']) => {
    switch (type) {
      case 'appointment':
        return {
          icon: 'ri-calendar-event-line',
          color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
        };
      case 'ip_inquiry':
        return {
          icon: 'ri-user-heart-line',
          color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
        };
      case 'system_alert':
        return {
          icon: 'ri-notification-badge-line',
          color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
        };
      case 'surrogate_inquiry':
      default:
        return {
          icon: 'ri-user-smile-line',
          color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
        };
    }
  };

  return (
    <div className="flex h-screen bg-gray-50/50 dark:bg-[#0b0814] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Notifications</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Review all system alerts and updates</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#15111f] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 dark:bg-white/5 mb-4">
                    <i className="ri-notification-off-line text-2xl text-gray-400"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">No notifications yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {notifications.map((item) => {
                    const styles = getNotificationStyles(item.type);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="p-4 sm:p-6 hover:bg-gray-50/80 dark:hover:bg-white/5 cursor-pointer transition-colors flex items-start sm:items-center gap-4"
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${styles.color}`}>
                          <i className={`${styles.icon} text-xl`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                            <p className="text-base font-medium text-gray-900 dark:text-white truncate">
                              {item.title}
                            </p>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {item.time}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {item.type === 'appointment' ? 'Title: ' : 'From '}
                            <span className="font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                          </p>
                        </div>
                        <div className="hidden sm:flex shrink-0">
                          <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            <i className="ri-arrow-right-line"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
