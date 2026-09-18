import { useEffect, useRef } from 'react'
import { useWallet } from '../store'

/**
 * Dismiss-on-navigate: invoke onClose whenever the navbar bumps
 * `sheetEpoch` (tab switch). Mount-safe — ignores the initial render.
 */
export function useDismissSheets(onClose: () => void) {
  const epoch = useWallet((s) => s.sheetEpoch)
  const first = useRef(true)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    closeRef.current()
  }, [epoch])
}
