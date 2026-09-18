import * as Select from '@radix-ui/react-select'
import type { CSSProperties, ReactNode } from 'react'

/**
 * shadcn-style dropdown (Radix Select primitive).
 * Controlled: `value` is always a string; map numbers/sentinels at the
 * call site. Empty value renders `placeholder`.
 */
export function CtosSelect({
  value,
  onValueChange,
  placeholder,
  label,
  disabled,
  triggerStyle,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder?: string
  label: string
  disabled?: boolean
  triggerStyle?: CSSProperties
  children: ReactNode
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger className="ui-select-trigger" style={triggerStyle} aria-label={label}>
        <Select.Value placeholder={placeholder ?? 'Select…'} />
        <Select.Icon className="ui-select-chevron" aria-hidden>
          ▾
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="ui-select-content"
          position="popper"
          sideOffset={6}
          avoidCollisions
        >
          <Select.Viewport className="ui-select-viewport">{children}</Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

export function CtosSelectItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Select.Item value={value} className="ui-select-item">
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="ui-select-check" aria-hidden>
        ✓
      </Select.ItemIndicator>
    </Select.Item>
  )
}
