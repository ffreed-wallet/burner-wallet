import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * shadcn-style Sheet rendered as a mobile bottom sheet.
 * Backdrop click / Escape dismiss (pass onOpenChange).
 */
export function Sheet({
  open,
  onOpenChange,
  label,
  title,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-sheet-overlay" />
        <Dialog.Content aria-label={label} className="ui-sheet-content" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="ui-sheet-grabber" aria-hidden>
            <span />
          </div>
          <div className="ui-sheet-header">
            <Dialog.Title className="ui-sheet-title">{title}</Dialog.Title>
          </div>
          <div className="ui-sheet-body">{children}</div>
          {footer && <div className="ui-sheet-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Simple skeleton block. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn('ui-skeleton', className)} style={style} />
}
