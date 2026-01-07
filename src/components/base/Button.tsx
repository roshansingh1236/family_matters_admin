
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  color?: 'green' | 'red' | 'blue';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
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
  className = '',
  type = 'button',
}) => {
  const baseClasses = 'whitespace-nowrap cursor-pointer font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2';
  
  const getVariantClasses = () => {
    if (color) {
      switch (color) {
        case 'green':
          return variant === 'outline' 
            ? 'border border-green-300 hover:border-green-400 text-green-700 bg-white hover:bg-green-50'
            : 'bg-green-600 hover:bg-green-700 text-white shadow-sm';
        case 'red':
          return variant === 'outline'
            ? 'border border-red-300 hover:border-red-400 text-red-700 bg-white hover:bg-red-50'
            : 'bg-red-600 hover:bg-red-700 text-white shadow-sm';
        case 'blue':
          return variant === 'outline'
            ? 'border border-blue-300 hover:border-blue-400 text-blue-700 bg-white hover:bg-blue-50'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm';
        default:
          return 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm';
      }
    }

    const variantClasses = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
      secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
      outline: 'border border-gray-300 hover:border-gray-400 text-gray-700 bg-white',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    };

    return variantClasses[variant];
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${getVariantClasses()} ${sizeClasses[size]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
