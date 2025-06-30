import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '../../constants.tsx'; // Assuming ChevronDownIcon is in constants.tsx
import { cn } from '../../constants.tsx'; // Assuming cn utility is in constants.tsx

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
  className,
  contentClassName,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className={cn("border border-border-subtle rounded-xl bg-bg-surface", className)}>
      <button
        type="button"
        onClick={toggleOpen}
        className="flex justify-between items-center w-full p-4 text-left text-text-strong font-semibold"
      >
        <span>{title}</span>
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="h-5 w-5 text-text-muted" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: "auto" },
              collapsed: { opacity: 0, height: 0 },
            }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className={cn("p-4 pt-0", contentClassName)}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
