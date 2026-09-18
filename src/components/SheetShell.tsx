import type { ReactNode } from 'react'
import { Sheet } from './ui/sheet'
import { useDismissSheets } from './useDismissSheets'

/**
 * Bottom-sheet shell (shadcn Sheet): grabber, title header, body, sticky footer.
 * Escape / backdrop click / navbar tab switch dismisses.
 */
export function SheetShell({
  label,
  title,
  onClose,
  children,
  footer,
}: {
  label: string
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useDismissSheets(onClose)
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      label={label}
      title={title}
      footer={footer}
    >
      {children}
    </Sheet>
  )
}
