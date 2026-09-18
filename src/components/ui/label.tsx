import * as LabelPrimitive from '@radix-ui/react-label'
import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/** shadcn-style Label. `muted` renders the small uppercase section style. */
export const Label = forwardRef<
  HTMLLabelElement,
  ComponentProps<typeof LabelPrimitive.Root> & { muted?: boolean }
>(({ muted, className, ...props }, ref) => {
  return (
    <LabelPrimitive.Root ref={ref} className={cn('ui-label', muted && 'ui-label-muted', className)} {...props} />
  )
})
Label.displayName = 'Label'

/** Small helper / error lines under a field. */
export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-hint', className)} {...props} />
}

export function FieldError({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="alert" className={cn('ui-error', className)} {...props} />
  )
}

/** Vertical field wrapper: Label + control + hint/error. */
export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-field', className)} {...props} />
}
