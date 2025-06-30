
import React, { useState, useMemo } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { CheckIcon, ChevronDownIcon, cn } from '../../constants.tsx';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  emptyMessage?: string;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  inputClassName?: string;
  error?: string;
  name?: string;
  disabled?: boolean;
  className?: string; // Added for general div wrapper styling
}

const popoverVariants = {
  hidden: { opacity: 0, y: -5, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: "circOut" as const } },
  exit: { opacity: 0, y: -5, scale: 0.98, transition: { duration: 0.15, ease: "circIn" as const } },
};

export const Combobox = React.forwardRef<
  HTMLButtonElement, // PopoverPrimitive.Trigger renders a button
  ComboboxProps
>(({
  options, value, onValueChange, placeholder = "Selecione...", label, emptyMessage = "Nenhum resultado.",
  triggerClassName, contentClassName, itemClassName, inputClassName, error, name, disabled,
  className, // Destructure className for the div wrapper
  ...restProps // Rest props could be passed to PopoverPrimitive.Root if needed
}, ref) => {
  const [open, setOpen] = useState(false);
  // We don't need internal filterValue state if Command handles it,
  // but it can be useful for advanced filtering or if Command.Input doesn't have its own state.
  // cmdk's Command.Input typically handles its own internal state for filtering.

  const selectedOptionLabel = useMemo(() => {
    return options.find(option => option.value === value)?.label || placeholder;
  }, [options, value, placeholder]);

  return (
    <div className={cn('w-full relative', className)}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium mb-1.5 text-text-default">
          {label}
        </label>
      )}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen} {...restProps}>
        <PopoverPrimitive.Trigger
          ref={ref}
          asChild
          disabled={disabled}
          name={name}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? `${name}-listbox` : undefined}
          aria-label={label || placeholder}
        >
          <button
            type="button"
            className={cn(
              `flex h-11 w-full items-center justify-between rounded-xl border bg-bg-surface bg-opacity-60 backdrop-blur-sm px-4 py-2.5 text-sm 
               focus:outline-none focus:ring-1 focus:ring-accent-blue-neon focus:border-border-interactive
               disabled:cursor-not-allowed disabled:opacity-50 
               hover:border-accent-blue-neon/70 transition-colors duration-150 caret-accent-blue-neon`,
              error ? 'border-status-error focus:ring-status-error focus:border-status-error text-status-error'
                    : 'border-border-subtle text-text-strong',
              value ? 'text-text-strong' : 'text-text-muted',
              triggerClassName
            )}
          >
            <span className="truncate">{selectedOptionLabel}</span>
            <ChevronDownIcon className={cn("h-5 w-5 text-text-muted opacity-70 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </PopoverPrimitive.Trigger>
        
        <AnimatePresence>
          {open && (
            <PopoverPrimitive.Portal forceMount>
              <PopoverPrimitive.Content
                asChild
                style={{ width: 'var(--radix-popover-trigger-width)' }} // Ensure popover matches trigger width
                sideOffset={5}
                align="start"
                className="z-50" // Ensure popover is above other content
              >
                <MotionDiv
                  variants={popoverVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={cn(
                    `relative z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border border-border-subtle 
                     bg-bg-surface bg-opacity-85 backdrop-blur-lg shadow-2xl mt-1`,
                    contentClassName
                  )}
                >
                  <Command 
                    shouldFilter={true} // cmdk handles filtering internally
                    // value={value} // No longer needed here as Command.Input will manage search
                    // onValueChange={onValueChange} // No longer needed here
                  >
                    <div className="p-2">
                      <Command.Input
                        placeholder="Buscar opção..."
                        className={cn(
                          `h-9 w-full rounded-md border border-border-subtle bg-bg-main px-3 py-2 text-sm text-text-default
                           placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue-neon focus:border-accent-blue-neon`,
                          inputClassName
                        )}
                        autoFocus
                      />
                    </div>
                    <Command.List id={`${name}-listbox`} className="p-1.5 max-h-[calc(15rem-3rem)] overflow-y-auto">
                      <Command.Empty className="py-4 text-center text-sm text-text-muted">
                        {emptyMessage}
                      </Command.Empty>
                      {options.map((option) => (
                        <Command.Item
                          key={option.value}
                          value={option.value} // cmdk uses this for filtering and selection
                          disabled={option.disabled}
                          onSelect={(currentValue) => { // cmdk's onSelect gives the selected value
                            onValueChange(currentValue);
                            setOpen(false);
                          }}
                          className={cn(
                            `relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-text-default
                             outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 
                             data-[selected=true]:bg-accent-blue-neon/10 data-[selected=true]:text-accent-blue-neon
                             data-[highlighted]:bg-white/10 data-[highlighted]:text-accent-blue-neon transition-colors`,
                            itemClassName
                          )}
                        >
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            {value === option.value && ( // Check against external value for the checkmark
                              <CheckIcon className="h-4 w-4 text-accent-blue-neon" />
                            )}
                          </span>
                          <span className="truncate">{option.label}</span>
                        </Command.Item>
                      ))}
                    </Command.List>
                  </Command>
                </MotionDiv>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          )}
        </AnimatePresence>
      </PopoverPrimitive.Root>
      {error && <p className="mt-1.5 text-xs text-status-error">{error}</p>}
    </div>
  );
});
Combobox.displayName = 'Combobox';
