
import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../constants'; // Assuming cn is in constants.tsx at src level

export interface TabConfig {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps extends Omit<React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>, 'children' | 'defaultValue'> {
  tabs: TabConfig[];
  defaultValue?: string;
  listClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
  layout?: 'horizontal' | 'vertical';
}

export const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ tabs, defaultValue, listClassName, triggerClassName, contentClassName, layout = 'horizontal', ...props }, ref) => {
  const defaultTabValue = defaultValue || (tabs.length > 0 ? tabs[0].value : undefined);

  return (
    <TabsPrimitive.Root
      ref={ref}
      defaultValue={defaultTabValue}
      orientation={layout}
      {...props}
    >
      <TabsPrimitive.List
        className={cn(
          "flex border-b border-border-subtle",
          layout === 'vertical' && "flex-col border-b-0 border-r space-y-1 pr-2",
          layout === 'horizontal' && "space-x-1",
          listClassName
        )}
        aria-label="Gerenciar seções de configuração"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className={cn(
              "relative inline-flex items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-medium ring-offset-bg-main transition-all duration-200 ease-in-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-neon focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
              "data-[state=active]:text-accent-blue-neon",
              "data-[state=inactive]:text-text-muted hover:text-text-default hover:bg-white/5",
              // Active indicator line
              "after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-transparent after:transition-all after:duration-200",
              "data-[state=active]:after:bg-accent-blue-neon data-[state=active]:after:shadow-[0_0_8px_var(--color-accent-blue-neon)]",
              layout === 'vertical' && "data-[state=active]:after:bottom-0 data-[state=active]:after:left-auto data-[state=active]:after:right-[-1px] data-[state=active]:after:top-0 data-[state=active]:after:h-full data-[state=active]:after:w-[2px] justify-start rounded-md",
              layout === 'horizontal' && "rounded-t-md",
              triggerClassName
            )}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.value}
          value={tab.value}
          className={cn(
            "mt-5 ring-offset-bg-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-neon focus-visible:ring-offset-1",
            layout === 'vertical' && "mt-0 ml-4", // Adjust margin for vertical layout
            contentClassName
          )}
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
});
Tabs.displayName = "Tabs";
