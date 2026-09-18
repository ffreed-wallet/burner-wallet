import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/** shadcn-style RadioGroup. */
export const RadioGroup = forwardRef<HTMLDivElement, ComponentProps<typeof RadioGroupPrimitive.Root>>(
  ({ className, ...props }, ref) => {
    return <RadioGroupPrimitive.Root ref={ref} className={cn('ui-radio-group', className)} {...props} />
  },
)
RadioGroup.displayName = 'RadioGroup'

export const RadioGroupItem = forwardRef<HTMLButtonElement, ComponentProps<typeof RadioGroupPrimitive.Item>>(
  ({ className, ...props }, ref) => {
    return <RadioGroupPrimitive.Item ref={ref} className={cn('ui-radio-item', className)} {...props} />
  },
)
RadioGroupItem.displayName = 'RadioGroupItem'

export function RadioCards({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('ui-radio-cards', className)} {...props} />
}

/** A selectable card wired to a RadioGroup value (label element). */
export function RadioCardOption({
  value,
  checked,
  onSelect,
  children,
}: {
  value: string
  checked: boolean
  onSelect: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      data-state={checked ? 'checked' : 'unchecked'}
      className="ui-radio-card"
      onClick={() => onSelect(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(value)
        }
      }}
    >
      {children}
    </div>
  )
}
