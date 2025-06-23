import React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '../../constants.tsx';

interface ToggleSwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>,
  'checked' |         // We use `enabled` which maps to `checked`
  'onCheckedChange' | // We use `onEnabledChange` which maps to `onCheckedChange`
  'defaultChecked'    // We use `defaultEnabled` which maps to `defaultChecked`
> {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void; // Renamed from onChange
  defaultEnabled?: boolean; // Optional: for uncontrolled mode
  label?: string;
  srLabel?: string; // For screen-reader only label if `label` prop is not visually displayed but needed for accessibility
  size?: 'sm' | 'md';
  // name prop is inherited from ComponentPropsWithoutRef
}

const ToggleSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  ToggleSwitchProps
>(({ enabled, onEnabledChange, defaultEnabled, label, srLabel, disabled = false, size = 'md', name, className, ...props }, ref) => {
  const sizeClasses = {
    sm: {
      root: 'h-5 w-9', // Adjusted width for better proportion with thumb
      thumb: 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5',
    },
    md: {
      root: 'h-6 w-11', // Adjusted width
      thumb: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
    },
  };
  const currentSize = sizeClasses[size];
  const switchId = name || srLabel || label || React.useId();

  return (
    <div className={cn("flex items-center", disabled ? 'opacity-50' : 'group', className)}>
      {label && (
        <label 
          htmlFor={switchId} 
          className={cn(
            "mr-3 text-sm font-medium transition-colors",
            disabled ? 'text-text-muted cursor-not-allowed' : 'text-text-default group-hover:text-text-strong cursor-pointer'
          )}
        >
          {label}
        </label>
      )}
      <SwitchPrimitives.Root
        id={switchId}
        checked={enabled}
        defaultChecked={defaultEnabled}
        onCheckedChange={onEnabledChange}
        disabled={disabled}
        name={name}
        ref={ref}
        className={cn(
          'peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg-main',
          'data-[state=checked]:bg-accent-blue-neon data-[state=unchecked]:bg-neutral-400', // Tailwind's neutral-400 is a good gray
          disabled ? 'cursor-not-allowed opacity-50' : '',
          currentSize.root
        )}
        {...props}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            'pointer-events-none block rounded-full bg-text-strong shadow-lg ring-0 transition-transform duration-200 ease-in-out',
            currentSize.thumb
          )}
        />
      </SwitchPrimitives.Root>
      {srLabel && !label && <span className="sr-only">{srLabel}</span>}
    </div>
  );
});
ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch };