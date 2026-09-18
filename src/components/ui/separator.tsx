import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/** shadcn-style Separator. */
export const Separator = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof SeparatorPrimitive.Root>
>(({ orientation = 'horizontal', className, ...props }, ref) => {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      orientation={orientation}
      className={cn('ui-separator', orientation === 'horizontal' ? 'ui-separator-horizontal' : 'ui-separator-vertical', className)}
      {...props}
    />
  )
})
Separator.displayName = 'Separator'
