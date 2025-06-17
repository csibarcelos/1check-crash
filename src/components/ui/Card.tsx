
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, title, actions, onClick }) => {
  return (
    <div 
      className={`bg-bg-surface border border-border-subtle backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-in-out ${onClick ? 'cursor-pointer hover:shadow-glow-blue-neon/30' : ''} ${className || ''}`}
      onClick={onClick}
    >
      {(title || actions) && (
        <div className="px-6 py-5 sm:px-8 border-b border-border-subtle flex justify-between items-center">
          {title && <h3 className="text-xl leading-7 font-semibold text-accent-gold">{title}</h3>}
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
};