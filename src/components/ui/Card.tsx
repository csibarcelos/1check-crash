
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  titleClassName?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
  noPadding?: boolean; // Adicionado para tabelas
  headerClassName?: string;
  contentClassName?: string;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className, 
  title, 
  titleClassName = 'text-card-title', // Aplicando a classe H2 por padrão
  actions, 
  onClick,
  noPadding = false,
  headerClassName = 'px-6 py-5 sm:px-8 border-b border-border-subtle flex justify-between items-center',
  contentClassName
}) => {
  return (
    <div 
      className={`bg-bg-surface border border-border-subtle backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-in-out ${onClick ? 'cursor-pointer hover:shadow-glow-blue-neon/30' : ''} ${className || ''}`}
      onClick={onClick}
    >
      {(title || actions) && (
        <div className={`${headerClassName} ${noPadding ? 'p-0' : ''}`}>
          {title && <h2 className={`${titleClassName}`}>{title}</h2>}
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={`${noPadding ? '' : 'p-6 sm:p-8'} ${contentClassName || ''}`}>
        {children}
      </div>
    </div>
  );
};
