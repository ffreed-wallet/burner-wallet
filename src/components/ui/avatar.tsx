import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

/** shadcn-style Avatar with image-or-fallback. */
export function Avatar({
  src,
  alt = '',
  fallback,
  size = 36,
  className,
}: {
  src?: string | null
  alt?: string
  fallback: React.ReactNode
  size?: number
  className?: string
}) {
  return (
    <span className={cn('ui-avatar', className)} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}>
      {src ? <img src={src} alt={alt} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : fallback}
    </span>
  )
}

/** shadcn-style Table primitives. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('ui-table', className)} {...props} />
}
