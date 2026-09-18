import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success'

/** shadcn-style Badge. */
export function Badge({
  variant = 'outline',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn('ui-badge', `ui-badge-${variant}`, className)} {...props} />
}
