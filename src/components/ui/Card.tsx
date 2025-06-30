
import React from 'react';
import { motion } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
  disableHoverEffect?: boolean;
}

const MotionDiv = motion.div as any;

export const Card: React.FC<CardProps> = ({ children, className, title, actions, onClick, disableHoverEffect = false }) => {
  return (
    <MotionDiv
      whileHover={!disableHoverEffect && onClick ? { scale: 1.02, filter: 'brightness(1.08)' } : {}}
      whileTap={!disableHoverEffect && onClick ? { scale: 0.99, y: 1 } : {}}
      transition={{ duration: 0.2, ease: "circOut" }}
      className={`bg-bg-surface border border-border-subtle backdrop-blur-md shadow-hard rounded-3xl overflow-hidden transition-all duration-300 ease-in-out
                  ${onClick && !disableHoverEffect ? 'cursor-pointer hover:shadow-glow-blue-neon/50 hover:border-accent-blue-neon/30' : ''} 
                  ${className || ''}`}
      onClick={onClick}
    >
      {(title || actions) && (
        <div className="px-6 py-5 sm:px-8 border-b border-border-subtle flex justify-between items-center">
          {title && <h3 className="text-xl leading-7 font-display font-semibold text-accent-gold">{title}</h3>}
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-6 sm:p-8">
        {children}
      </div>
    </MotionDiv>
  );
};
