import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

/** shadcn-style Alert. */
export function Alert({
  variant = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' }) {
  return (
    <div role="alert" className={cn('ui-alert', variant === 'destructive' && 'ui-alert-destructive', className)} {...props} />
  )
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-alert-title', className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-alert-desc', className)} {...props} />
}
