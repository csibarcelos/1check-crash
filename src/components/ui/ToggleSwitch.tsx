import React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '../../constants.tsx';

// Define ToggleSwitchProps:
// - It extends Radix's Root component props but omits those we manage (checked, onCheckedChange, defaultChecked).
// - 'className' is for the wrapper div.
// - 'disabled' and 'name' (and others) are inherited from Radix's Root props.
interface ToggleSwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>,
  'checked' |         // Managed by 'enabled'
  'onCheckedChange' | // Managed by 'onEnabledChange'
  'defaultChecked'    // Managed by 'defaultEnabled'
> {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  defaultEnabled?: boolean;
  label?: string;
  srLabel?: string;
  size?: 'sm' | 'md';
  labelClassName?: string;
  labelStyle?: React.CSSProperties;
  // `className` here is intended for the wrapper div.
  // `disabled`, `name`, and other native props for SwitchPrimitives.Root are inherited.
}

const ToggleSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  ToggleSwitchProps
>(({
  // Custom props for our ToggleSwitch behavior and wrapper
  enabled,
  onEnabledChange,
  defaultEnabled,
  label,
  srLabel,
  size = 'md',
  labelClassName,
  labelStyle,
  className, // This className is for the wrapper div

  // Destructure Radix Root specific props (these are inherited via extends Omit<...>)
  // Provide defaults where applicable if they differ from Radix's internal defaults
  disabled = false,
  name,

  // Capture all other props that might be passed (e.g., data-*, aria-*)
  ...restSwitchProps
}, ref) => {
  const sizeClasses = {
    sm: {
      root: 'h-5 w-9',
      thumb: 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5',
    },
    md: {
      root: 'h-6 w-11',
      thumb: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
    },
  };
  const currentSize = sizeClasses[size];
  const switchId = name || srLabel || label || React.useId();

  // Explicitly remove 'children' from restSwitchProps if it exists,
  // as SwitchPrimitives.Root does not accept it directly.
  // Its child is SwitchPrimitives.Thumb.
  const { children, ...passThroughProps } = restSwitchProps;


  return (
    <div className={cn("flex items-center", disabled ? 'opacity-50' : 'group', className /* wrapper's className */)}>
      {label && (
        <label
          htmlFor={switchId}
          className={cn(
            "mr-3 text-sm font-medium transition-colors",
            disabled ? 'text-text-muted cursor-not-allowed' : 'text-text-default group-hover:text-text-strong cursor-pointer',
            labelClassName
          )}
          style={labelStyle}
        >
          {label}
        </label>
      )}
      <SwitchPrimitives.Root
        id={switchId}
        checked={enabled}
        defaultChecked={defaultEnabled}
        onCheckedChange={onEnabledChange}
        disabled={disabled} // Pass the destructured 'disabled'
        name={name}         // Pass the destructured 'name'
        ref={ref}
        className={cn(
          'peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg-main',
          'data-[state=checked]:bg-accent-blue-neon data-[state=unchecked]:bg-neutral-400',
          disabled ? 'cursor-not-allowed opacity-50' : '',
          currentSize.root
          // Any 'className' specifically for the Root component itself, if passed via ...restSwitchProps,
          // would be merged here if 'passThroughProps' contained it.
          // However, Radix's 'className' prop on Root is what this 'cn' call is for.
        )}
        {...passThroughProps} // Spread remaining valid props for SwitchPrimitives.Root
      >
        <SwitchPrimitives.Thumb
          className={cn( // This className for Thumb should be valid
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