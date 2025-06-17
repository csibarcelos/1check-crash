
import React from 'react';
import { Link, type LinkProps } from "react-router-dom"; 

interface ButtonBaseProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

interface StandardButtonProps extends ButtonBaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  to?: undefined;
}

interface LinkButtonProps extends ButtonBaseProps, Omit<LinkProps, 'children' | 'className'> {
  to: string;
}

export type ButtonProps = StandardButtonProps | LinkButtonProps;

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  to,
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-main transition-all duration-300 ease-in-out inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.03] active:scale-[0.98]';

  const variantStyles = {
    primary: 'bg-accent-blue-neon text-black hover:bg-opacity-80 focus:ring-accent-blue-neon shadow-md hover:shadow-glow-blue-neon/70',
    gold: 'bg-accent-gold text-black hover:bg-opacity-80 focus:ring-accent-gold shadow-md hover:shadow-glow-gold/70',
    secondary: 'bg-neutral-700 text-text-strong hover:bg-neutral-600 focus:ring-neutral-500', 
    danger: 'bg-status-error text-text-strong hover:bg-opacity-80 focus:ring-status-error',
    ghost: 'text-text-default hover:bg-bg-surface hover:text-text-strong focus:ring-accent-blue-neon',
    outline: 'border border-border-subtle text-text-default hover:bg-bg-surface hover:border-accent-blue-neon hover:text-accent-blue-neon focus:ring-accent-blue-neon',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm h-10',
    md: 'px-6 py-2.5 text-base h-12', 
    lg: 'px-8 py-3 text-lg h-14',   
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  const content = (
    <>
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <>
          {leftIcon && <span className="mr-2 -ml-1 h-5 w-5">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2 -mr-1 h-5 w-5">{rightIcon}</span>}
        </>
      )}
    </>
  );

  if (to) {
    const linkSpecificProps = props as Omit<LinkProps, 'to' | 'children' | 'className'>;
    if (isLoading || (props as StandardButtonProps).disabled) {
        return (
            <span className={`${combinedClassName} opacity-50 cursor-not-allowed`} aria-disabled="true">
                {content}
            </span>
        );
    }
    return (
      <Link to={to} className={combinedClassName} {...linkSpecificProps}>
        {content}
      </Link>
    );
  }

  const buttonSpecificProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      className={combinedClassName}
      disabled={isLoading || buttonSpecificProps.disabled}
      {...buttonSpecificProps}
    >
      {content}
    </button>
  );
};


interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  srLabel?: string;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, label, srLabel, disabled = false }) => {
  return (
    <div className={`flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {label && <span className={`mr-3 text-sm font-medium ${disabled ? 'text-text-muted' : 'text-text-default'}`}>{label}</span>}
      <button
        type="button"
        className={`${
          enabled ? 'bg-accent-blue-neon' : 'bg-neutral-700' 
        } relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-blue-neon focus:ring-offset-2 focus:ring-offset-bg-main
        ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
        role="switch"
        aria-checked={enabled}
        onClick={() => {
          if (!disabled) {
            onChange(!enabled);
          }
        }}
        disabled={disabled}
      >
        <span className="sr-only">{srLabel || label || 'Toggle'}</span>
        <span
          aria-hidden="true"
          className={`${
            enabled ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-text-strong shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </div>
  );
};
