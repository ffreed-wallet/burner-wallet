import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { SheetShell } from './SheetShell'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { FieldHint } from './ui/label'

/**
 * Shared QR scanner — works on iOS too.
 * Fast path: native BarcodeDetector (Chrome Android). Fallback: jsQR over
 * camera frames (iPhone Safari supports getUserMedia; no native detector).
 */
export function QrScanner({
  onScan,
  onClose,
  hint,
}: {
  /** Raw QR payload (caller validates). */
  onScan: (raw: string) => void
  onClose: () => void
  hint?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const doneRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'native' | 'jsqr' | null>(null)

  const stop = () => {
    cancelAnimationFrame(rafRef.current)
    window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop()
      } catch {
        /* noop */
      }
    })
    streamRef.current = null
  }

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('No camera on this device.')
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        const BD = (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector
        if (BD) {
          setMode('native')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (BD as any)({ formats: ['qr_code'] })
          const loop = async () => {
            if (cancelled || doneRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              const raw = codes?.[0]?.rawValue as string | undefined
              if (raw) {
                doneRef.current = true
                onScan(raw)
                return
              }
            } catch {
              /* keep scanning */
            }
            rafRef.current = requestAnimationFrame(() => void loop())
          }
          rafRef.current = requestAnimationFrame(() => void loop())
        } else {
          setMode('jsqr')
          timerRef.current = window.setInterval(() => {
            if (cancelled || doneRef.current) return
            const video = videoRef.current
            const canvas = canvasRef.current
            if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return
            const w = video.videoWidth
            const h = video.videoHeight
            if (!w || !h) return
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (!ctx) return
            ctx.drawImage(video, 0, 0, w, h)
            try {
              const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)
              if (found?.data) {
                doneRef.current = true
                onScan(found.data)
              }
            } catch {
              /* keep scanning */
            }
          }, 200)
        }
      } catch {
        if (!cancelled) setError('Camera blocked — allow access to scan.')
      }
    }
    void start()
    return () => {
      cancelled = true
      stop()
    }
    // onScan identity changes per render would restart camera; caller memo not required — scan once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SheetShell
      label="scan QR"
      title="Scan QR"
      onClose={() => {
        stop()
        onClose()
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 'var(--radius)' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden />
          <FieldHint>
            {hint ?? 'Point at a QR code.'}
            {mode === 'jsqr' ? ' (compat mode)' : ''}
          </FieldHint>
        </div>
      )}
      <Button
        variant="outline"
        block
        onClick={() => {
          stop()
          onClose()
        }}
      >
        Close
      </Button>
    </SheetShell>
  )
}
