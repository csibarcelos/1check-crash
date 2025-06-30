
import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from "framer-motion";
import { XMarkIcon } from '../../constants'; // Assumindo que XMarkIcon está em constants.tsx

const MotionDiv = motion.div as any;

// cn utility (pode ser local se preferir não depender de constants.tsx para este componente UI)
const cn = (...classes: (string | undefined | null | false)[]): string => classes.filter(Boolean).join(' ');

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  theme?: 'light' | 'dark-app'; 
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', theme = 'dark-app' }) => {
  const sizeClasses = {
    sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl', '2xl': 'sm:max-w-2xl', '3xl': 'sm:max-w-3xl',
  };

  const isLightTheme = theme === 'light';

  const panelClasses = isLightTheme
    ? 'checkout-light-theme bg-[var(--checkout-color-bg-surface)] border-[var(--checkout-color-border-subtle)]'
    : 'bg-bg-surface bg-opacity-70 backdrop-blur-lg border-border-subtle'; 

  const titleClasses = isLightTheme
    ? 'modal-title-light-theme-text-force-dark' // Alterado para usar a nova classe CSS
    : 'text-accent-gold';

  const closeButtonClasses = isLightTheme
    ? 'text-[var(--checkout-color-text-muted)] hover:text-[var(--checkout-color-text-strong)] hover:bg-neutral-100 focus:ring-offset-[var(--checkout-color-bg-surface)] focus:ring-[var(--checkout-color-primary-DEFAULT)]'
    : 'text-text-muted hover:text-text-strong hover:bg-white/10 focus:ring-offset-bg-surface focus:ring-accent-blue-neon';
  
  const contentTextClasses = isLightTheme
    ? 'text-[var(--checkout-color-text-default)]'
    : 'text-text-default';

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "circOut" as const } },
    exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2, ease: "circIn" as const } }
  };
  
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50 app-dark-theme" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <MotionDiv 
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/80 backdrop-blur-md" 
          />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment} 
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel 
                as={MotionDiv} 
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  'relative overflow-hidden rounded-3xl text-left shadow-2xl sm:my-8 sm:w-full border',
                  panelClasses,
                  sizeClasses[size]
                )}
              >
                <div className={cn(
                  'px-6 py-5 border-b flex justify-between items-center',
                  isLightTheme ? 'border-[var(--checkout-color-border-subtle)]' : 'border-border-subtle'
                )}>
                  {title && (
                    <Dialog.Title as="h3" className={cn(
                      'text-xl font-display font-semibold leading-7',
                      titleClasses 
                    )}>
                      {title}
                    </Dialog.Title>
                  )}
                  {!title && <div className="flex-grow"></div>} 
                  <button
                    type="button"
                    className={cn(
                      'rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150',
                      closeButtonClasses
                    )}
                    onClick={onClose}
                    aria-label="Fechar modal"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <div className={cn('p-6 sm:p-8', contentTextClasses)}>
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
