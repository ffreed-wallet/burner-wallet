import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

/**
 * Install coaching:
 * - Chromium/Android: real `beforeinstallprompt` banner.
 * - iOS: no install prompt exists — step-by-step Add to Home Screen card.
 * Both dismissible + remembered. Old-app standalone detection reused.
 */
export function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('burner.installDismissed') === '1',
  )
  const [isIos, setIsIos] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)').matches
    const iosStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsInstalled(Boolean(mq || iosStandalone))
    const ua = navigator.userAgent
    setIsIos(
      /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    )
    const onBip = (e: Event) => {
      e.preventDefault()
      setBip(e as BIPEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const dismiss = () => {
    localStorage.setItem('burner.installDismissed', '1')
    setDismissed(true)
  }

  if (dismissed || isInstalled) return null

  if (bip) {
    return (
      <Alert role="region" aria-label="Install app" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertDescription style={{ flex: 1 }}>
            Install Burner for full-screen + offline shell.
          </AlertDescription>
          <Button
            size="sm"
            onClick={() => {
              void bip.prompt()
              dismiss()
            }}
          >
            Install
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
            ✕
          </Button>
        </div>
      </Alert>
    )
  }

  if (isIos) {
    return (
      <Alert role="region" aria-label="Add to Home Screen" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
        <AlertDescription>
          <b>Add to Home Screen</b> for full-screen: tap <b>Share ⏏</b> → <b>Add to Home Screen</b>{' '}
          → <b>Add</b>.{' '}
          <Button variant="link" size="sm" onClick={dismiss}>
            Got it
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
