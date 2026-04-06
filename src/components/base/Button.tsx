import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  color?: 'green' | 'red' | 'blue' | 'teal';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  color,
  onClick,
  disabled = false,
  isLoading = false,
  className = '',
  type = 'button',
}) => {
  const baseClasses = 'whitespace-nowrap cursor-pointer font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2';

  const getVariantClasses = () => {
    if (color) {
      switch (color) {
        case 'green':
          return variant === 'outline'
            ? 'border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20';
        case 'red':
          return variant === 'outline'
            ? 'border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10'
            : 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20';
        case 'blue':
          return variant === 'outline'
            ? 'border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-500/10'
            : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-500/20';
        case 'teal':
          return variant === 'outline'
            ? 'border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 bg-transparent hover:bg-teal-50 dark:hover:bg-teal-500/10'
            : 'bg-teal-500 hover:bg-teal-600 text-white shadow-sm shadow-teal-500/20';
        default:
          return 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-sm shadow-rose-500/20';
      }
    }

    const variantClasses: Record<string, string> = {
      primary: 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-sm shadow-rose-500/20',
      secondary: 'bg-rose-50 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-white/10 text-rose-600 dark:text-rose-400',
      outline: 'border border-rose-200 dark:border-white/10 text-gray-700 dark:text-gray-300 bg-transparent hover:bg-rose-50 dark:hover:bg-white/5 hover:text-rose-600 dark:hover:text-rose-400',
      danger: 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20',
    };

    return variantClasses[variant];
  };

  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-sm',
  };

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${getVariantClasses()} ${sizeClasses[size]} ${disabledClasses} ${className}`}
    >
      {isLoading && <i className="ri-loader-4-line animate-spin"></i>}
      {children}
    </button>
  );
};

export default Button;
