import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { useState, type CSSProperties, type ReactNode } from 'react'

export interface ComboboxOption {
  value: string
  label: ReactNode
  /** Extra match text (chain, balance…). Matched alongside the id. */
  search?: string
}

/**
 * shadcn-style Combobox (Radix Popover + cmdk Command).
 * Searchable dropdown for long option lists (tokens, chains).
 * Controlled: `value` is always a string; map numbers/sentinels at the
 * call site. Empty value renders `placeholder`.
 */
export function CtosCombobox({
  value,
  onValueChange,
  label,
  placeholder,
  searchPlaceholder,
  emptyText,
  triggerStyle,
  options,
}: {
  value: string
  onValueChange: (v: string) => void
  label: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  triggerStyle?: CSSProperties
  options: ComboboxOption[]
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="ui-combobox-trigger"
          style={triggerStyle}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="ui-combobox-value">
            {selected ? (
              selected.label
            ) : (
              <span className="ui-combobox-placeholder">{placeholder ?? 'Select…'}</span>
            )}
          </span>
          <span className="ui-combobox-chevron" aria-hidden>
            ▾
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="ui-combobox-content" sideOffset={6} align="start" avoidCollisions>
          <Command label={label} loop>
            <div className="ui-combobox-searchwrap">
              <span aria-hidden>⌕</span>
              <Command.Input
                placeholder={searchPlaceholder ?? 'Search…'}
                className="ui-combobox-search"
                aria-label={`Search ${label}`}
              />
            </div>
            <Command.List className="ui-combobox-list" aria-label={label}>
              <Command.Empty className="ui-combobox-empty">{emptyText ?? 'No match.'}</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={o.value}
                  keywords={o.search ? [o.search] : []}
                  onSelect={(v) => {
                    onValueChange(v)
                    setOpen(false)
                  }}
                  className="ui-combobox-item"
                >
                  <span className="ui-combobox-itemlabel">{o.label}</span>
                  {o.value === value && (
                    <span className="ui-combobox-check" aria-hidden>
                      ✓
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
