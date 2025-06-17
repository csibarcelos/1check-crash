import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '../../constants.tsx'; 

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  theme?: 'light' | 'dark';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', theme = 'dark' }) => {
  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
  };

  const isLightTheme = theme === 'light';

  const panelClasses = isLightTheme
    ? 'checkout-light-theme bg-[var(--checkout-color-bg-surface)] border-[var(--checkout-color-border-subtle)]'
    : 'bg-bg-surface border-border-subtle';

  const titleClasses = isLightTheme
    ? 'text-[var(--checkout-color-primary-DEFAULT)]' 
    : 'text-accent-gold';

  const closeButtonClasses = isLightTheme
    ? 'text-[var(--checkout-color-text-muted)] hover:text-[var(--checkout-color-text-strong)] hover:bg-neutral-100 focus:ring-offset-[var(--checkout-color-bg-surface)] focus:ring-[var(--checkout-color-primary-DEFAULT)]'
    : 'text-text-muted hover:text-text-strong hover:bg-white/10 focus:ring-offset-bg-surface focus:ring-accent-blue-neon';
  
  const contentTextClasses = isLightTheme
    ? 'text-[var(--checkout-color-text-default)]'
    : 'text-text-default';


  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel 
                className={`relative transform overflow-hidden rounded-2xl text-left shadow-2xl transition-all sm:my-8 sm:w-full border ${panelClasses} ${sizeClasses[size]}`}
              >
                <div className={`px-6 py-5 border-b ${isLightTheme ? 'border-[var(--checkout-color-border-subtle)]' : 'border-border-subtle'} flex justify-between items-center`}>
                  {title && (
                    <Dialog.Title as="h3" className={`text-xl font-semibold leading-7 ${titleClasses}`}>
                      {title}
                    </Dialog.Title>
                  )}
                  {!title && <div className="flex-grow"></div>} 
                  <button
                    type="button"
                    className={`rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ${closeButtonClasses}`}
                    onClick={onClose}
                    aria-label="Fechar modal"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <div className={`p-6 sm:p-8 ${contentTextClasses}`}>
                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};