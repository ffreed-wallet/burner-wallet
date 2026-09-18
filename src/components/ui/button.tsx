import { Slot } from '@radix-ui/react-slot'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  asChild?: boolean
}

/** shadcn-style Button. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', block, asChild, className, type = 'button', ...props }, ref) => {
    const cls = cn(
      'ui-btn',
      `ui-btn-${variant}`,
      size === 'sm' && 'ui-btn-sm',
      size === 'lg' && 'ui-btn-lg',
      size === 'icon' && 'ui-btn-icon',
      block && 'ui-btn-block',
      className,
    )
    if (asChild) {
      return <Slot ref={ref} className={cls} {...props} />
    }
    return <button ref={ref} type={type} className={cls} {...props} />
  },
)
Button.displayName = 'Button'
