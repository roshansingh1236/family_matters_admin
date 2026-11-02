import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  subMessage?: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, subMessage, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: { bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-500/20', icon: 'ri-checkbox-circle-fill text-emerald-500' },
    error:   { bg: 'bg-red-50 dark:bg-red-500/10 border-red-200/70 dark:border-red-500/20',           icon: 'ri-error-warning-fill text-red-500'   },
    info:    { bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200/70 dark:border-rose-500/20',       icon: 'ri-information-fill text-rose-500'    },
  };

  const s = styles[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border ${s.bg} max-w-sm backdrop-blur-xl`}>
        <i className={`${s.icon} text-lg mt-0.5 flex-shrink-0`}></i>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{message}</p>
          {subMessage && <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{subMessage}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0">
          <i className="ri-close-line text-base"></i>
        </button>
      </div>
    </div>
  );
};

export default Toast;
