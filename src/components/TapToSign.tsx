import { useEffect, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, formatEther, http } from 'viem'
import { friendlyCardError, getCardAccount, shortAddress, signWithPinRetry } from '../lib/burner'
import { allChains, rpcUrl } from '../lib/chains'
import {
  estimateFee,
  estimateGasLimit,
  feeForSpeed,
  formatGwei,
  type FeeEstimate,
  type GasSpeed,
} from '../lib/gas'
import { useWallet } from '../store'
import { PinPrompt } from './PinPrompt'
import { SheetShell } from './SheetShell'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { Table } from './ui/avatar'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

export interface SignLine {
  k: string
  v: string
}

/** Optional gas hint: enables the fee UI + balance pre-check. */
export interface TapGasHint {
  to?: `0x${string}`
  data?: `0x${string}`
  value?: bigint
  gasLimit?: bigint
}

const SPEEDS: { id: GasSpeed; label: string }[] = [
  { id: 'slow', label: 'Slow' },
  { id: 'standard', label: 'Standard' },
  { id: 'fast', label: 'Fast' },
]

/**
 * Unified Tap-to-Sign review sheet:
 * shows balance changes + gas, then NFC tap on the card signs.
 *
 * When `gas` is provided, a speed selector + estimated-fee rows appear and
 * the final tx is built by calling buildTx() first, then overlaying the
 * chosen fee fields + gas limit. Without `gas`, behavior is unchanged.
 */
export function TapToSign({
  open,
  title,
  lines,
  chainId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildTx,
  onDone,
  onClose,
  gas,
  nativePriceUsd,
  initialSpeed = 'standard',
}: {
  open: boolean
  title: string
  lines: SignLine[]
  chainId: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildTx: () => Promise<any>
  onDone: (hash: `0x${string}`) => void
  onClose: () => void
  gas?: TapGasHint
  nativePriceUsd?: number
  initialSpeed?: GasSpeed
}) {
  const { requestScan, addPendingTx, demo } = useWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsCard, setNeedsCard] = useState(false)
  const [speed, setSpeed] = useState<GasSpeed>(initialSpeed)
  const [feeBase, setFeeBase] = useState<FeeEstimate | null>(null)
  const [gasLimit, setGasLimit] = useState<bigint | null>(null)
  const [feeBusy, setFeeBusy] = useState(false)
  const [feeError, setFeeError] = useState<string | null>(null)
  // Tap-to-expand for address lines: default truncated, tap toggles full.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Sign-time PIN prompt (PIN-gated slots reject `sign` without a password).
  const [pinReason, setPinReason] = useState<'needed' | 'wrong' | null>(null)
  const pinWaiter = useRef<{ resolve: (v: string | null) => void } | null>(null)
  useEffect(
    () => () => {
      pinWaiter.current?.resolve(null)
      pinWaiter.current = null
    },
    [],
  )
  const askPin = (reason: 'needed' | 'wrong'): Promise<string | null> =>
    new Promise((resolve) => {
      pinWaiter.current = { resolve }
      setPinReason(reason)
    })
  const resolvePin = (v: string | null) => {
    pinWaiter.current?.resolve(v)
    pinWaiter.current = null
    setPinReason(null)
  }

  const withGas = gas !== undefined
  const isAddrLine = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim())

  // Fetch fee + gas-limit estimates while the sheet is open.
  // Re-fetch when the preview changes (to/data/value) — not just open/chain.
  const gasPreviewKey = withGas ? `${gas?.to ?? ''}:${gas?.data ?? ''}:${gas?.value?.toString() ?? ''}:${gas?.gasLimit?.toString() ?? ''}` : 'no-gas'
  useEffect(() => {
    if (!open || !withGas) return
    let cancelled = false
    setFeeBusy(true)
    setFeeError(null)
    setFeeBase(null)
    setGasLimit(null)
    const run = async () => {
      try {
        const entry = allChains(true).find((c) => c.chain.id === chainId)
        if (!entry) throw new Error(`Unknown chain ${chainId}`)
        const [fees, limit] = await Promise.all([
          estimateFee(chainId),
          (async () => {
            if (gas?.gasLimit != null) return gas.gasLimit
            const client = createPublicClient({
              chain: entry.chain,
              transport: http(rpcUrl(entry)),
            })
            return estimateGasLimit(client, {
              account: getCardAccount()?.address,
              to: gas?.to,
              data: gas?.data,
              value: gas?.value,
            })
          })(),
        ])
        if (!cancelled) {
          setFeeBase(fees)
          setGasLimit(limit)
        }
      } catch (e) {
        if (!cancelled) setFeeError(e instanceof Error ? e.message : 'Fee estimate failed.')
      } finally {
        if (!cancelled) setFeeBusy(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // gas fields are hints for one sheet-open; re-fetch on open/chain/preview change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chainId, withGas, gasPreviewKey])

  // Reset tap-to-expand state each time the sheet opens / lines change.
  useEffect(() => {
    if (open) setExpanded({})
  }, [open, lines])

  if (!open) return null

  const chosen = feeBase ? feeForSpeed(feeBase, speed) : null
  const feePerGas = chosen?.maxFeePerGas ?? chosen?.gasPrice ?? null
  const limit = gas?.gasLimit ?? gasLimit
  const feeWei = feePerGas != null && limit != null ? feePerGas * limit : null
  const trimFee = (s: string) => {
    const [ip, fp = ''] = s.split('.')
    const t = fp.replace(/0+$/, '').slice(0, 8)
    return t ? `${ip}.${t}` : ip
  }
  const feeNative = feeWei != null ? trimFee(formatEther(feeWei)) : null
  const feeFiat =
    feeWei != null && nativePriceUsd != null
      ? (Number(formatEther(feeWei)) * nativePriceUsd).toFixed(2)
      : null
  const nativeSym = feeBase?.nativeSymbol ?? ''

  const sign = async () => {
    setError(null)
    setNeedsCard(false)
    if (demo) {
      setError('Demo mode — signing disabled. Use a real card session.')
      return
    }
    setBusy(true)
    try {
      const account = getCardAccount()
      if (!account) {
        setNeedsCard(true)
        throw new Error('Card not in session. Tap your card to continue.')
      }
      const entry = allChains(true).find((c) => c.chain.id === chainId)
      if (!entry) throw new Error(`Unknown chain ${chainId}`)
      const base = await buildTx()
      let request = base
      if (withGas) {
        // Resolve the fee selection fresh so the signed tx matches the UI.
        const fees = feeBase ?? (await estimateFee(chainId))
        const picked = feeForSpeed(fees, speed)
        const publicClient = createPublicClient({
          chain: entry.chain,
          transport: http(rpcUrl(entry)),
        })
        const resolvedLimit =
          gas?.gasLimit ??
          gasLimit ??
          (await estimateGasLimit(publicClient, {
            account: account.address,
            to: (base?.to ?? gas?.to) as `0x${string}` | undefined,
            data: (base?.data ?? gas?.data) as `0x${string}` | undefined,
            value: (base?.value ?? gas?.value) as bigint | undefined,
          }))
        const perGas = picked.maxFeePerGas ?? picked.gasPrice ?? null
        if (perGas == null) throw new Error('Fee estimate unavailable — try again.')
        const txValue: bigint =
          typeof base?.value === 'bigint' ? base.value : (gas?.value ?? 0n)
        const fee = perGas * resolvedLimit
        const balance = await publicClient.getBalance({ address: account.address })
        const need = txValue + fee
        if (balance < need) {
          const sym = fees.nativeSymbol
          throw new Error(
            `Insufficient ${sym} for gas — need ${formatEther(need)} ${sym}, have ${formatEther(balance)} ${sym}`,
          )
        }
        request = { ...base, ...picked, gas: resolvedLimit }
      }
      const client = createWalletClient({
        account,
        chain: entry.chain,
        transport: http(rpcUrl(entry)),
      })
      // Each viem sign* call triggers one NFC tap via the card account.
      // PIN-gated slots prompt here (sign time), never at scan time.
      const hash = await signWithPinRetry(() => client.sendTransaction(request), askPin)
      addPendingTx(hash)
      onDone(hash)
    } catch (e) {
      setError(friendlyCardError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SheetShell
        label={title}
        title={title}
        onClose={onClose}
        footer={
          <>
            {needsCard ? (
              <Button
                size="lg"
                block
                onClick={() => {
                  requestScan()
                  onClose()
                }}
              >
                Tap card to connect
              </Button>
            ) : (
              <Button size="lg" block disabled={busy || (withGas && feeBusy)} onClick={() => void sign()}>
                {busy ? 'Hold card to phone…' : withGas && feeBusy ? 'Estimating fee…' : 'Tap card to sign'}
              </Button>
            )}
            <Button variant="outline" block onClick={onClose}>
              Cancel
            </Button>
          </>
        }
      >
        <Table>
          <tbody>
            {lines.map((l) => {
              const addr = isAddrLine(l.v)
              const isOpen = !!expanded[l.k]
              return (
                <tr key={l.k}>
                  <th>{l.k}</th>
                  <td className="ui-mono">
                    {addr ? (
                      <Button
                        variant="link"
                        onClick={() => setExpanded((p) => ({ ...p, [l.k]: !p[l.k] }))}
                        title={isOpen ? 'Tap to collapse' : 'Tap to expand full address'}
                        aria-expanded={isOpen}
                        style={{ padding: 0, minHeight: 0, fontSize: '0.8125rem' }}
                      >
                        {isOpen ? l.v.trim() : shortAddress(l.v.trim())}
                      </Button>
                    ) : (
                      l.v
                    )}
                  </td>
                </tr>
              )
            })}
            {withGas && (
              <>
                <tr>
                  <th>Gas limit</th>
                  <td>{limit != null ? limit.toString() : feeBusy ? '…' : '—'}</td>
                </tr>
                <tr>
                  <th>Fee rate</th>
                  <td>{feePerGas != null ? formatGwei(feePerGas) : feeBusy ? '…' : '—'}</td>
                </tr>
                <tr>
                  <th>Est. fee</th>
                  <td>
                    {feeNative != null
                      ? `${feeNative} ${nativeSym}${feeFiat != null ? ` (~$${feeFiat})` : ''}`
                      : feeBusy
                        ? '…'
                        : '—'}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </Table>
        {withGas && (
          <div>
            <Tabs value={speed} onValueChange={(v) => setSpeed(v as GasSpeed)}>
              <TabsList aria-label="Fee speed">
                {SPEEDS.map((s) => (
                  <TabsTrigger key={s.id} value={s.id}>
                    {s.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {feeError && (
              <Alert style={{ marginTop: 8 }}>
                <AlertDescription>Fee estimate: {feeError} (showing —)</AlertDescription>
              </Alert>
            )}
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Sign failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </SheetShell>
      {pinReason && (
        <PinPrompt reason={pinReason} onSubmit={(v) => resolvePin(v)} onCancel={() => resolvePin(null)} />
      )}
    </>
  )
}
