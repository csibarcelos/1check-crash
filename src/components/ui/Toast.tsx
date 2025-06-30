
import React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../constants.tsx';
import { XMarkIcon, CheckIcon, InformationCircleIcon } from '../../constants.tsx'; // Assumindo que tem ExclamationTriangleIcon
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'; // Import específico

const MotionLi = motion.li as any;
const MotionOl = motion.ol as any;

// Renomeando o ToastProvider do context para evitar conflito com o Radix Provider
import { useToast as useAppToast, ToastOptions as AppToastOptions } from '@/contexts/ToastContext'; 

// Variants for Framer Motion
const viewportVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.1 } },
  exit: { opacity: 0 },
};

const toastVariants = {
  initial: { opacity: 0, y: 50, scale: 0.3 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.5, transition: { duration: 0.2 } },
};

const getVariantClasses = (variant?: AppToastOptions['variant']) => {
  switch (variant) {
    case 'success':
      return {
        icon: <CheckIcon className="h-6 w-6 text-status-success" />,
        borderColor: 'border-status-success',
      };
    case 'error':
      return {
        icon: <ExclamationTriangleIcon className="h-6 w-6 text-status-error" />,
        borderColor: 'border-status-error',
      };
    case 'warning':
      return {
        icon: <ExclamationTriangleIcon className="h-6 w-6 text-status-warning" />,
        borderColor: 'border-status-warning',
      };
    case 'info':
    default:
      return {
        icon: <InformationCircleIcon className="h-6 w-6 text-accent-blue-neon" />,
        borderColor: 'border-accent-blue-neon',
      };
  }
};


export const Toaster: React.FC = () => {
  const { toasts, dismissToast } = useAppToast();

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const variantStyle = getVariantClasses(toast.variant);
          return (
            <ToastPrimitives.Root
              key={toast.id}
              asChild
              forceMount
              duration={toast.duration}
              onOpenChange={(open) => {
                if (!open && toast.id) {
                  dismissToast(toast.id);
                }
              }}
            >
              <MotionLi
                layout
                variants={toastVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={cn(
                  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-2xl border p-5 pr-8 shadow-2xl transition-all',
                  'bg-bg-surface bg-opacity-80 backdrop-blur-lg', // Glassmorphism
                  variantStyle.borderColor,
                  'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none'
                )}
              >
                <div className="flex items-start space-x-3">
                  {variantStyle.icon}
                  <div className="grid gap-1">
                    <ToastPrimitives.Title className="text-md font-semibold text-text-strong font-display">
                      {toast.title}
                    </ToastPrimitives.Title>
                    {toast.description && (
                      <ToastPrimitives.Description className="text-sm text-text-default">
                        {toast.description}
                      </ToastPrimitives.Description>
                    )}
                  </div>
                </div>
                {toast.action && (
                  <ToastPrimitives.Action
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors',
                      'border-border-interactive hover:bg-white/10 text-accent-blue-neon focus:outline-none focus:ring-2 focus:ring-accent-blue-neon focus:ring-offset-2 focus:ring-offset-bg-surface'
                    )}
                    altText={toast.action.label}
                    onClick={(e) => {
                      e.preventDefault(); // Prevent default Radix close behavior if action handles it
                      toast.action?.onClick();
                      if (toast.id) dismissToast(toast.id);
                    }}
                  >
                    {toast.action.label}
                  </ToastPrimitives.Action>
                )}
                <ToastPrimitives.Close
                  className={cn(
                    'absolute right-2 top-2 rounded-md p-1 text-text-muted opacity-70 transition-opacity hover:text-text-strong hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent-blue-neon group-hover:opacity-100'
                  )}
                  aria-label="Fechar notificação"
                >
                  <XMarkIcon className="h-5 w-5" />
                </ToastPrimitives.Close>
              </MotionLi>
            </ToastPrimitives.Root>
          );
        })}
      </AnimatePresence>
      <ToastPrimitives.Viewport
        asChild
      >
        <MotionOl
          variants={viewportVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed bottom-0 right-0 z-[100] flex w-full flex-col-reverse gap-3 p-6 sm:bottom-auto sm:right-0 sm:top-0 sm:flex-col md:max-w-lg"
        />
      </ToastPrimitives.Viewport>
    </ToastPrimitives.Provider>
  );
};
