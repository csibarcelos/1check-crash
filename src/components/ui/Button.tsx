
import React from 'react';
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface ButtonBaseProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isFullWidth?: boolean;
  // Nova propriedade para controlar o espaçamento dos ícones
  iconSpacing?: 'tight' | 'normal' | 'loose';
}

interface StandardButtonProps extends ButtonBaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  to?: undefined;
}

// Corrected LinkButtonProps to use React.ComponentProps<typeof Link>
interface LinkButtonProps extends ButtonBaseProps, Omit<React.ComponentProps<typeof Link>, 'children' | 'className'> {
  to: string;
}

export type ButtonProps = StandardButtonProps | LinkButtonProps;

const MotionButton = motion.button;
const MotionLink = motion(Link);

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  isFullWidth = false,
  iconSpacing = 'normal',
  to,
  ...props
}) => {
  const baseStyles = `
    font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 
    focus:ring-offset-bg-main transition-all duration-200 ease-in-out 
    inline-flex items-center justify-center disabled:opacity-50 
    disabled:cursor-not-allowed relative
  `.replace(/\s+/g, ' ').trim();

  const variantStyles = {
    primary: 'bg-primary text-primary-cta-text hover:bg-opacity-85 focus:ring-primary shadow-md hover:shadow-glow-blue-neon/50',
    gold: 'bg-secondary text-secondary-cta-text hover:bg-opacity-85 focus:ring-secondary shadow-md hover:shadow-glow-gold/50',
    secondary: 'bg-neutral-200 text-text-strong hover:bg-neutral-300 focus:ring-neutral-400',
    danger: 'bg-status-error text-white hover:bg-opacity-90 focus:ring-status-error shadow-md',
    ghost: 'text-text-default hover:bg-bg-surface-opaque hover:text-accent-blue-neon focus:ring-primary',
    outline: 'border-2 border-border-interactive text-text-default hover:border-accent-blue-neon hover:text-accent-blue-neon/10 focus:ring-primary focus:border-accent-blue-neon',
  };

  // Tamanhos com melhor proporção e espaçamento
  const sizeStyles = {
    sm: 'px-4 py-2.5 text-xs min-h-[40px]',
    md: 'px-6 py-3.5 text-sm min-h-[48px]', 
    lg: 'px-8 py-4.5 text-base min-h-[56px]',
  };

  // Espaçamento dos ícones baseado no tamanho do botão
  const getIconSpacing = () => {
    const spacingMap = {
      tight: { sm: 'gap-1', md: 'gap-1.5', lg: 'gap-2' },
      normal: { sm: 'gap-2', md: 'gap-2.5', lg: 'gap-3' },
      loose: { sm: 'gap-2.5', md: 'gap-3', lg: 'gap-4' }
    };
    return spacingMap[iconSpacing][size];
  };

  // Tamanhos dos ícones proporcionais ao botão
  const getIconSize = () => {
    const iconSizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    };
    return iconSizes[size];
  };

  const fullWidthClass = isFullWidth ? 'w-full' : '';
  const spacingClass = getIconSpacing();
  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidthClass} ${spacingClass} ${className}`;

  const buttonMotionProps = { 
    whileHover: { 
      scale: 1.02, 
      filter: variant === 'primary' || variant === 'gold' ? 'brightness(1.05)' : undefined,
      transition: { duration: 0.2 }
    },
    whileTap: { 
      scale: 0.98, 
      transition: { duration: 0.1 }
    },
    transition: { 
      duration: 0.2, 
      ease: "easeInOut" 
    },
  };

  const iconSize = getIconSize();

  const renderContent = () => {
    if (isLoading) {
      return (
        <svg 
          className={`animate-spin ${iconSize} text-current`} 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    }

    return (
      <>
        {leftIcon && (
          <div className={`${iconSize} flex items-center justify-center flex-shrink-0`}>
            {leftIcon}
          </div>
        )}
        <span className="text-center font-inherit flex-1 leading-normal">
          {children}
        </span>
        {rightIcon && (
          <div className={`${iconSize} flex items-center justify-center flex-shrink-0`}>
            {rightIcon}
          </div>
        )}
      </>
    );
  };

  if (to) {
    const linkSpecificProps = props as Omit<React.ComponentProps<typeof Link>, 'to' | 'children' | 'className'>;
    if (isLoading || (props as StandardButtonProps).disabled) {
      return (
        <span 
          className={`${combinedClassName} opacity-50 cursor-not-allowed`} 
          aria-disabled="true"
        >
          {renderContent()}
        </span>
      );
    }
    return (
      <MotionLink
        to={to}
        className={combinedClassName}
        {...(linkSpecificProps as any)} 
        {...buttonMotionProps}
      >
        {renderContent()}
      </MotionLink>
    );
  }

  const buttonSpecificProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <MotionButton
      className={combinedClassName}
      disabled={isLoading || buttonSpecificProps.disabled}
      {...(buttonSpecificProps as any)} 
      {...buttonMotionProps}
    >
      {renderContent()}
    </MotionButton>
  );
};