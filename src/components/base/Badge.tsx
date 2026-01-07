
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  color?: 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple' | 'indigo' | 'pink';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  color,
  size = 'md',
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center font-medium rounded-full whitespace-nowrap';
  
  const getColorClasses = () => {
    if (color) {
      switch (color) {
        case 'yellow':
          return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'blue':
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'green':
          return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'red':
          return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'gray':
          return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        case 'purple':
          return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
        case 'indigo':
          return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
        case 'pink':
          return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      }
    }

    const variantClasses = {
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };

    return variantClasses[variant];
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span className={`${baseClasses} ${getColorClasses()} ${sizeClasses[size]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
