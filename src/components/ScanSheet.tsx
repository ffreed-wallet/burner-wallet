import { useEffect, useRef, useState } from 'react'
import { getNfcStatus, scanBurnerCard } from '../lib/burner'
import { useWallet } from '../store'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { CloseIcon } from './ui/icons'
import { useDismissSheets } from './useDismissSheets'

/**
 * Strict card-only gate. No address typing, no seed import, no watch mode.
 * Transport matches libhalo: `webnfc` on Android Chrome, `credential`
 * (iOS system NFC sheet, same as burner.pro) on iPhone.
 *
 * Scanning is a PUBLIC read — no PIN here. A PIN-gated card asks for its
 * PIN at SIGN time (see PinPrompt), where it is remembered briefly.
 *
 * Plain fixed overlay (same pattern as TokenSelectSheet) — no dialog
 * portal, so it renders everywhere the token picker does.
 */
export function ScanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setSession } = useWallet()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const nfc = getNfcStatus()

  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [open])

  useDismissSheets(onClose)

  if (!open) return null

  const start = async () => {
    setError(null)
    setBusy(true)
    try {
      const session = await scanBurnerCard()
      if (cancelled.current) return
      setSession({ address: session.address })
      onClose()
    } catch (e) {
      if (!cancelled.current) {
        setError(e instanceof Error ? e.message : 'Scan failed. Try again.')
      }
    } finally {
      if (!cancelled.current) setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="ui-sheet-overlay" onClick={onClose}>
      <div
        className="ui-sheet-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Scan Burner card"
      >
        <div className="ui-sheet-grabber" aria-hidden>
          <span />
        </div>
        <div className="ui-sheet-header">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Tap your Burner</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>
        <div className="ui-sheet-body">
          {!nfc.ok && (
            <Alert>
              <AlertTitle>NFC not available here</AlertTitle>
              <AlertDescription>
                Card tap needs a phone: Chrome / Edge / Opera / Samsung Internet on NFC Android,
                or any browser on iPhone (iOS pops its own NFC sheet). Desktops can&apos;t tap —
                copy this link to your phone.
              </AlertDescription>
            </Alert>
          )}

          {nfc.ok && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {nfc.method === 'credential' ? (
                <Alert>
                  <AlertDescription>
                    1. Tap Start scan — {nfc.isIOS ? 'iOS' : 'your phone'} will pop its{' '}
                    <b>system NFC sheet</b> (same as burner.pro).
                    <br />
                    2. Hold the card {nfc.isIOS ? 'to the top of the iPhone' : 'to the phone'}{' '}
                    until it checks.
                    <br />
                    3. Keys never leave the card — this app only keeps the address.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertDescription>
                    1. Tap Start scan, then hold the card to the back of the phone.
                    <br />
                    2. Hold steady until it checks — reading is public, no PIN needed.
                    <br />
                    3. If your card has a PIN, you&apos;ll enter it when signing.
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <p className="ui-hint">
                Locked after 20 wrong PINs (permanent, by card design). Address is remembered on
                this device; every signature still needs the card.
              </p>
            </div>
          )}
        </div>
        <div className="ui-sheet-footer">
          {nfc.ok ? (
            <>
              <Button size="lg" block disabled={busy} onClick={() => void start()}>
                {busy ? 'Waiting for card…' : 'Start scan'}
              </Button>
              <Button variant="outline" block onClick={onClose}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" block onClick={() => void copyLink()}>
                {copied ? 'Link copied ✓' : 'Copy this link'}
              </Button>
              <Button variant="outline" block onClick={onClose}>
                Close
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
