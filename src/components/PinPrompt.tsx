import { useState } from 'react'
import { pinTtlLabel } from '../lib/burner'
import { SheetShell } from './SheetShell'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Field, Label } from './ui/label'

/**
 * Sign-time card PIN prompt. Shown when the slot demands a password
 * (missing) or rejects it (wrong) — never at scan time, where no PIN
 * is involved. The PIN goes straight to the card handle + short-term
 * memory; it is never persisted.
 */
export function PinPrompt({
  reason,
  onSubmit,
  onCancel,
}: {
  reason: 'needed' | 'wrong'
  onSubmit: (pin: string) => void
  onCancel: () => void
}) {
  const [pin, setPin] = useState('')
  const [show, setShow] = useState(false)
  const empty = pin.trim().length === 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = pin.trim()
    if (!v) return
    setPin('')
    onSubmit(v)
  }

  return (
    <SheetShell label="Card PIN" title="Card PIN" onClose={onCancel}>
      <Card>
        <CardContent>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reason === 'wrong' ? (
              <Alert variant="destructive">
                <AlertTitle>Incorrect PIN</AlertTitle>
                <AlertDescription>
                  Attempts are limited — the card locks after repeated failures.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertDescription>
                  This card&apos;s slot is PIN-gated. Enter it once — it&apos;s kept in
                  memory only ({pinTtlLabel()}), never stored.
                </AlertDescription>
              </Alert>
            )}
            <Field>
              <Label htmlFor="card-pin">Card PIN</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  id="card-pin"
                  style={{ flex: 1, minWidth: 0, fontSize: 20, letterSpacing: '0.2em', textAlign: 'center' }}
                  inputMode="numeric"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  autoFocus
                  maxLength={32}
                  type={show ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  aria-label="Card PIN"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide PIN' : 'Show PIN'}
                  aria-pressed={show}
                  title={show ? 'Hide PIN' : 'Show PIN'}
                >
                  {show ? '◠' : '◉'}
                </Button>
              </div>
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="button" variant="outline" block onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" block disabled={empty}>
                Unlock & continue
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </SheetShell>
  )
}
