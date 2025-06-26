
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactElement<React.SVGProps<SVGSVGElement>>;
  rightElement?: React.ReactNode; // Nova prop para elemento à direita
  labelClassName?: string;
  wrapperClassName?: string;
}

export const Input: React.FC<InputProps> = ({ label, name, error, icon, rightElement, className, labelClassName, wrapperClassName, ...props }) => {
  const hasError = Boolean(error);
  return (
    <div className={`w-full ${wrapperClassName || ''}`}>
      {label && (
        <label 
          htmlFor={name} 
          className={`block text-sm font-medium mb-1.5 ${labelClassName || 'text-text-default'}`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted">
            {React.cloneElement(icon, { className: 'h-5 w-5' })}
          </div>
        )}
        <input
          id={name}
          name={name}
          className={`block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-200 ease-in-out
            bg-bg-surface bg-opacity-60 backdrop-blur-sm caret-accent-blue-neon
            ${icon ? 'pl-12' : 'pl-4'}
            ${rightElement ? 'pr-12' : 'pr-4'} 
            ${hasError 
              ? 'border-status-error focus:ring-1 focus:ring-status-error focus:border-status-error text-status-error placeholder-status-error/70' 
              : 'border-border-subtle focus:border-border-interactive focus:ring-1 focus:ring-accent-blue-neon text-text-strong placeholder-text-muted'}
            ${props.disabled ? 'bg-neutral-200/20 cursor-not-allowed opacity-60' : 'hover:border-accent-blue-neon/70'}
            ${className || ''}
          `}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-status-error">{error}</p>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  rightElement?: React.ReactNode; // Nova prop para elemento à direita (menos comum em textareas, mas possível)
  labelClassName?: string;
  wrapperClassName?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, name, error, rightElement, className, labelClassName, wrapperClassName, ...props }) => {
  const hasError = Boolean(error);
  return (
    <div className={`w-full ${wrapperClassName || ''}`}>
      {label && (
        <label 
          htmlFor={name} 
          className={`block text-sm font-medium mb-1.5 ${labelClassName || 'text-text-default'}`}
        >
          {label}
        </label>
      )}
      <div className="relative"> {/* Adicionado para posicionar rightElement se necessário */}
        <textarea
          id={name}
          name={name}
          rows={props.rows || 4}
          className={`block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-200 ease-in-out
            bg-bg-surface bg-opacity-60 backdrop-blur-sm caret-accent-blue-neon
            ${rightElement ? 'pr-12' : 'pr-4'}
            ${hasError 
              ? 'border-status-error focus:ring-1 focus:ring-status-error focus:border-status-error text-status-error placeholder-status-error/70' 
              : 'border-border-subtle focus:border-border-interactive focus:ring-1 focus:ring-accent-blue-neon text-text-strong placeholder-text-muted'}
            ${props.disabled ? 'bg-neutral-200/20 cursor-not-allowed opacity-60' : 'hover:border-accent-blue-neon/70'}
            ${className || ''}
          `}
          {...props}
        />
        {rightElement && (
          <div className="absolute top-2 right-0 pr-3 flex items-center"> {/* Ajustar posicionamento para textarea */}
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-status-error">{error}</p>}
    </div>
  );
};
