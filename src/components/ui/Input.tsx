
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactElement<React.SVGProps<SVGSVGElement>>; // Changed from React.ReactElement
  labelClassName?: string;
}

export const Input: React.FC<InputProps> = ({ label, name, error, icon, className, labelClassName, ...props }) => {
  const hasError = Boolean(error);
  return (
    <div className="w-full">
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
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
            {React.cloneElement(icon, { className: 'h-5 w-5' })}
          </div>
        )}
        <input
          id={name}
          name={name}
          className={`block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out
            bg-white/5 backdrop-blur-sm caret-accent-blue-neon
            ${icon ? 'pl-12' : 'pl-4'}
            ${hasError 
              ? 'border-status-error focus:ring-2 focus:ring-status-error focus:border-status-error text-status-error placeholder-status-error/70' 
              : 'border-border-subtle focus:border-accent-blue-neon focus:ring-2 focus:ring-accent-blue-neon/70 text-text-strong placeholder-text-muted'}
            ${props.disabled ? 'bg-neutral-700/50 cursor-not-allowed opacity-60' : 'hover:border-opacity-50 hover:border-accent-blue-neon/50'}
            ${className || ''}
          `}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-status-error">{error}</p>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  labelClassName?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, name, error, className, labelClassName, ...props }) => {
  const hasError = Boolean(error);
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={name} 
          className={`block text-sm font-medium mb-1.5 ${labelClassName || 'text-text-default'}`}
        >
          {label}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        rows={props.rows || 4}
        className={`block w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-150 ease-in-out
          bg-white/5 backdrop-blur-sm caret-accent-blue-neon
          ${hasError 
            ? 'border-status-error focus:ring-2 focus:ring-status-error focus:border-status-error text-status-error placeholder-status-error/70' 
            : 'border-border-subtle focus:border-accent-blue-neon focus:ring-2 focus:ring-accent-blue-neon/70 text-text-strong placeholder-text-muted'}
          ${props.disabled ? 'bg-neutral-700/50 cursor-not-allowed opacity-60' : 'hover:border-opacity-50 hover:border-accent-blue-neon/50'}
          ${className || ''}
        `}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-status-error">{error}</p>}
    </div>
  );
};