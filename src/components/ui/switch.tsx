import * as SwitchPrimitive from '@radix-ui/react-switch'
import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/** shadcn-style Switch. */
export const Switch = forwardRef<HTMLButtonElement, ComponentProps<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => {
    return (
      <SwitchPrimitive.Root ref={ref} className={cn('ui-switch', className)} {...props}>
        <SwitchPrimitive.Thumb className="ui-switch-thumb" />
      </SwitchPrimitive.Root>
    )
  },
)
Switch.displayName = 'Switch'

/** Labelled switch row used for boolean settings. */
export function SwitchRow({
  label,
  hint,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root> & { label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="ui-switch-row">
      <span className="ui-switch-label">
        {label}
        {hint && <span className="ui-hint" style={{ display: 'block', marginTop: 2 }}>{hint}</span>}
      </span>
      <Switch {...props} />
    </label>
  )
}
