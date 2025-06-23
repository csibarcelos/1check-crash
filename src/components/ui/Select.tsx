import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon } from '../../constants.tsx';
import { cn } from '../../constants.tsx'; // Import cn from constants.tsx

// Define custom props specific to our Select component wrapper
interface SelectCustomProps {
  placeholder?: string;
  label?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  className?: string; // For the main wrapper div
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  error?: string;

  // Explicitly list Radix Root props that are destructured in the component
  // to ensure they are recognized on SelectProps.
  // Types should match Radix's own prop types.
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  dir?: 'ltr' | 'rtl';
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

// Combine Radix Root props with our custom props
interface SelectProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>, SelectCustomProps {}

export const Select = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectProps
>(
  (props: SelectProps, ref) => {
    const {
      // Custom props
      placeholder,
      label,
      options,
      className,
      triggerClassName,
      contentClassName,
      itemClassName,
      error,

      // Radix Root props (now also explicitly part of SelectCustomProps for robust destructuring)
      value,
      onValueChange,
      defaultValue,
      open,
      onOpenChange,
      dir,
      name,
      disabled,
      required,

      ...restRootProps // Any other Radix Root props not explicitly destructured
    } = props;

    return (
      <div className={className}>
        {label && (
          <label
            htmlFor={name} // Use name for htmlFor if present
            className="block text-sm font-medium mb-1.5 text-text-default"
          >
            {label}
          </label>
        )}
        <SelectPrimitive.Root
          value={value}
          onValueChange={onValueChange}
          defaultValue={defaultValue}
          open={open}
          onOpenChange={onOpenChange}
          dir={dir}
          name={name}
          disabled={disabled}
          required={required}
          {...restRootProps} // Spread the rest of the Radix Root props
        >
          <SelectPrimitive.Trigger
            ref={ref}
            id={name} // Use name for id if label points to it
            disabled={disabled} // Pass disabled to Trigger as well
            className={cn(
              `flex h-11 w-full items-center justify-between rounded-xl border bg-bg-surface bg-opacity-60 backdrop-blur-sm px-4 py-2.5 text-sm text-text-strong
               placeholder:text-text-muted
               focus:outline-none focus:ring-1 focus:ring-accent-blue-neon focus:border-border-interactive
               disabled:cursor-not-allowed disabled:opacity-50
               hover:border-accent-blue-neon/70 transition-colors duration-150 caret-accent-blue-neon`,
              error ? 'border-status-error focus:ring-1 focus:ring-status-error focus:border-status-error' : 'border-border-subtle',
              triggerClassName
            )}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <ChevronDownIcon className="h-5 w-5 text-text-muted opacity-70" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={5}
              className={cn(
                `relative z-50 min-w-[var(--radix-select-trigger-width)] max-h-[var(--radix-select-content-available-height)]
                 overflow-hidden rounded-2xl border border-border-subtle
                 bg-bg-surface bg-opacity-80 backdrop-blur-lg shadow-2xl
                 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
                 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
                 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2
                 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`,
                contentClassName
              )}
            >
              <SelectPrimitive.Viewport
                className="p-1.5" // Padding for items within the viewport
                style={{ maxHeight: 'var(--radix-select-content-available-height)' }}
              >
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      `relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-text-default
                       outline-none focus:bg-white/10 focus:text-accent-blue-neon
                       data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors`,
                       itemClassName
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <CheckIcon className="h-4 w-4 text-accent-blue-neon" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {error && <p className="mt-1.5 text-xs text-status-error">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';