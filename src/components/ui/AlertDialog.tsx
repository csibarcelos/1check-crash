
import React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ButtonProps } from '@/components/ui/Button';
import { cn } from '../../constants';

const MotionDiv = motion.div as any;

interface AlertDialogProps {
  isOpen: boolean;
  onOpenChange?: (open: boolean) => void; 
  onClose?: () => void; 
  title: React.ReactNode;
  description: React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmButtonVariant?: ButtonProps['variant'];
  children?: React.ReactNode; // Para botões adicionais
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2, delay: 0.1 } },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "circOut" as const } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2, ease: "circIn" as const } },
};

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onOpenChange,
  onClose,
  title,
  description,
  onConfirm,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmButtonVariant = 'primary',
  children, // Para botões adicionais
}) => {
  const handleRadixOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    }
    if (!open && onClose) {
      onClose(); 
    }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <AlertDialogPrimitive.Root open={isOpen} onOpenChange={handleRadixOpenChange}>
          <AlertDialogPrimitive.Portal forceMount>
            <AlertDialogPrimitive.Overlay asChild forceMount>
              <MotionDiv
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
              />
            </AlertDialogPrimitive.Overlay>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <AlertDialogPrimitive.Content asChild forceMount>
                <MotionDiv
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={cn(
                    "relative z-50 grid w-full max-w-lg gap-4 rounded-2xl border border-border-subtle bg-bg-surface bg-opacity-75 p-6 shadow-2xl backdrop-blur-lg",
                    "sm:rounded-2xl md:w-full"
                  )}
                >
                  <AlertDialogPrimitive.Title className="text-xl font-display font-semibold text-text-strong">
                    {title}
                  </AlertDialogPrimitive.Title>
                  <AlertDialogPrimitive.Description className="text-sm text-text-default">
                    {description}
                  </AlertDialogPrimitive.Description>
                  <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:space-x-0 sm:gap-3">
                    <AlertDialogPrimitive.Cancel asChild>
                      <Button variant="ghost" onClick={onClose} className="sm:order-1"> {/* Continuar/Cancelar */}
                        {cancelText}
                      </Button>
                    </AlertDialogPrimitive.Cancel>
                    {/* Botões adicionais (children) virão aqui, se existirem */}
                    {children && <div className="sm:order-2">{children}</div>} 
                    <AlertDialogPrimitive.Action asChild>
                      <Button variant={confirmButtonVariant} onClick={onConfirm} className="sm:order-3"> {/* Salvar e Sair / Confirmar Ação Principal */}
                        {confirmText}
                      </Button>
                    </AlertDialogPrimitive.Action>
                  </div>
                </MotionDiv>
              </AlertDialogPrimitive.Content>
            </div>
          </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
      )}
    </AnimatePresence>
  );
};
