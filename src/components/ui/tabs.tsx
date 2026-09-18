import * as TabsPrimitive from '@radix-ui/react-tabs'
import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/** shadcn-style Tabs. */
export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<HTMLDivElement, ComponentProps<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => {
    return <TabsPrimitive.List ref={ref} className={cn('ui-tabs-list', className)} {...props} />
  },
)
TabsList.displayName = 'TabsList'

export const TabsTrigger = forwardRef<HTMLButtonElement, ComponentProps<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => {
    return <TabsPrimitive.Trigger ref={ref} className={cn('ui-tabs-trigger', className)} {...props} />
  },
)
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = TabsPrimitive.Content
