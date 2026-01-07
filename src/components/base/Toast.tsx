
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
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColors = {
    success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
  };

  const iconColors = {
    success: 'text-emerald-500 dark:text-emerald-400',
    error: 'text-red-500 dark:text-red-400',
    info: 'text-blue-500 dark:text-blue-400'
  };

  const icons = {
    success: 'ri-checkbox-circle-fill',
    error: 'ri-error-warning-fill',
    info: 'ri-information-fill'
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border ${bgColors[type]} max-w-md`}>
        <i className={`${icons[type]} ${iconColors[type]} text-xl mt-0.5`}></i>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{message}</h4>
          {subMessage && (
            <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">{subMessage}</p>
          )}
        </div>
        <button 
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
};

export default Toast;
