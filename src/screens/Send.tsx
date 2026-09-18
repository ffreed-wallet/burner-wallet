import { useEffect, useMemo, useState } from 'react'
import { encodeFunctionData, erc20Abi, isAddress, parseUnits } from 'viem'
import { QrScanner } from '../components/QrScanner'
import { TapToSign } from '../components/TapToSign'
import { TokenIcon } from '../components/TokenIcon'
import { TokenSelectSheet, type SelectableToken } from '../components/TokenSelectSheet'
import { shortAddress } from '../lib/burner'
import { allChains } from '../lib/chains'
import { isEnsName, resolveEns } from '../lib/ens'
import { formatAmount } from '../lib/sync'
import { useWallet } from '../store'
import type { GasSpeed } from '../lib/gas'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  ChevronDownIcon,
  ScanIcon,
  CheckIcon,
  FuelIcon,
  ArrowLeftIcon,
} from '../components/ui/icons'

export function parseScannedPayload(raw: string): `0x${string}` | null {
  const v = raw.trim()
  if (!v) return null
  let s = v
  if (/^ethereum:/i.test(s)) s = s.replace(/^ethereum:/i, '')
  const m = s.match(/0x[0-9a-fA-F]{40}/)
  if (m && isAddress(m[0])) return m[0] as `0x${string}`
  if (isAddress(s)) return s as `0x${string}`
  return null
}

type FeeTier = GasSpeed

const FEE_TIERS: { id: FeeTier; name: string; hint: string }[] = [
  { id: 'slow', name: 'Slow', hint: '~30s' },
  { id: 'standard', name: 'Normal', hint: '~3s' },
  { id: 'fast', name: 'Fast', hint: '~1s' },
]

const PCTS = [25, 50, 75] as const

export function Send({ onBack }: { onBack?: () => void }) {
  const { session, tokens, contacts, prices } = useWallet()
  const [selectedToken, setSelectedToken] = useState<SelectableToken | null>(null)
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<'token' | 'usd'>('token')
  const [feeTier, setFeeTier] = useState<FeeTier>('standard')
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<`0x${string}` | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [ensAddress, setEnsAddress] = useState<`0x${string}` | null>(null)
  const [ensError, setEnsError] = useState<string | null>(null)
  const [ensLoading, setEnsLoading] = useState(false)

  const chainsAll = useMemo(() => allChains(true), [])

  // Build selectable tokens list from wallet tokens
  const selectableTokens: SelectableToken[] = useMemo(() => {
    return tokens.map((t) => ({
      chainId: t.chainId,
      contractAddress: t.contractAddress,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      balance: t.balance,
      priceUsd: t.priceUsd ?? prices[t.symbol.toUpperCase()],
      logo: t.logo,
      isOwned: t.balance > 0n,
    }))
  }, [tokens, prices])

  // Select default token if not set
  useEffect(() => {
    if (!selectedToken && selectableTokens.length > 0) {
      const best = selectableTokens.find((t) => t.balance > 0n) ?? selectableTokens[0]
      setSelectedToken(best)
    }
  }, [selectableTokens, selectedToken])

  const selectedChain = useMemo(
    () => chainsAll.find((c) => c.chain.id === selectedToken?.chainId) ?? chainsAll[0],
    [chainsAll, selectedToken],
  )

  const tokenPrice =
    selectedToken?.priceUsd ??
    (selectedToken ? prices[selectedToken.symbol.toUpperCase()] : undefined)

  // ENS resolution
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      const v = to.trim()
      if (!v) {
        setEnsAddress(null)
        setEnsError(null)
        setEnsLoading(false)
        return
      }
      if (isAddress(v)) {
        if (!cancelled) {
          setEnsAddress(v as `0x${string}`)
          setEnsError(null)
          setEnsLoading(false)
        }
        return
      }
      if (!isEnsName(v)) {
        if (!cancelled) {
          setEnsAddress(null)
          setEnsError(null)
          setEnsLoading(false)
        }
        return
      }
      if (!cancelled) {
        setEnsAddress(null)
        setEnsLoading(true)
        setEnsError(null)
      }
      const normalized = v.toLowerCase()
      void resolveEns(normalized).then((r) => {
        if (cancelled) return
        if (to.trim().toLowerCase() !== normalized) return
        setEnsLoading(false)
        if (r.address) {
          setEnsAddress(r.address)
          setEnsError(null)
        } else {
          setEnsAddress(null)
          setEnsError(r.error ?? 'Name not found')
        }
      })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [to])

  const trimmedTo = to.trim()
  const effectiveTo = isAddress(trimmedTo)
    ? (trimmedTo as `0x${string}`)
    : isEnsName(trimmedTo)
      ? ensAddress
      : null
  const toValid = !!effectiveTo && isAddress(effectiveTo)

  const parsed = useMemo(() => {
    if (!selectedToken || !amount) return null
    try {
      const clean = amount.trim().replace(/,/g, '')
      if (!clean || clean === '.' || isNaN(Number(clean))) return null
      if (unit === 'token') return parseUnits(clean, selectedToken.decimals)
      if (tokenPrice == null || tokenPrice <= 0) return null
      const tokenAmt = Number(clean) / tokenPrice
      if (!Number.isFinite(tokenAmt) || tokenAmt <= 0) return null
      return parseUnits(tokenAmt.toFixed(Math.min(selectedToken.decimals, 18)), selectedToken.decimals)
    } catch {
      return null
    }
  }, [selectedToken, amount, unit, tokenPrice])

  const amountValid = parsed != null && parsed > 0n
  const afford =
    selectedToken && parsed != null ? parsed <= selectedToken.balance && parsed > 0n : false

  const pasteClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) return
      const text = (await navigator.clipboard.readText()) ?? ''
      const addr = parseScannedPayload(text)
      if (addr) setTo(addr)
      else if (text.trim()) setTo(text.trim())
    } catch {
      /* ignore */
    }
  }

  const setPct = (pct: number) => {
    if (!selectedToken) return
    try {
      const slice = (selectedToken.balance * BigInt(pct)) / 100n
      if (unit === 'usd' && tokenPrice != null) {
        const tokenUnits = Number(slice) / 10 ** selectedToken.decimals
        setAmount((tokenUnits * tokenPrice).toFixed(2))
      } else {
        setAmount(formatAmount(slice, selectedToken.decimals))
      }
    } catch {
      /* ignore */
    }
  }

  const canReview = !!selectedToken && toValid && amountValid && afford && !ensLoading

  const sendError = !selectedToken
    ? 'Select a token to send'
    : !to.trim()
      ? null
      : ensLoading
        ? 'Resolving ENS…'
        : !toValid
          ? 'Enter a valid address or ENS'
          : !amount.trim()
            ? null
            : !amountValid
              ? 'Enter a valid amount'
              : !afford
                ? `Insufficient ${selectedToken.symbol} balance`
                : null

  return (
    <div className="ui-screen space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeftIcon size={20} />
            </button>
          )}
          <h1 className="text-base font-bold tracking-tight">Send Crypto</h1>
        </div>
        {selectedToken && (
          <Badge variant="outline" className="text-xs font-semibold py-0.5 px-2">
            {selectedChain.badge} {selectedChain.chain.name}
          </Badge>
        )}
      </div>

      {/* Asset Selector Container */}
      <div className="ui-card p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Asset
        </div>
        <button
          type="button"
          onClick={() => setTokenModalOpen(true)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors border border-border/60"
        >
          {selectedToken ? (
            <div className="flex items-center gap-3">
              <TokenIcon
                symbol={selectedToken.symbol}
                logo={selectedToken.logo}
                chainBadge={selectedChain.badge}
                size={34}
              />
              <div className="text-left">
                <div className="font-bold text-sm">{selectedToken.symbol}</div>
                <div className="text-xs text-muted-foreground">
                  Balance: {formatAmount(selectedToken.balance, selectedToken.decimals)}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm font-medium">Select a token</span>
          )}
          <ChevronDownIcon size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Recipient Container */}
      <div className="ui-card p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Recipient
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="vitalik.eth or 0x…"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setEnsAddress(null)
              setEnsError(null)
            }}
            className="ui-input pr-20 text-xs font-mono"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={pasteClipboard}
              className="px-2 py-1 text-xs font-semibold rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              Paste
            </button>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Scan QR Code"
            >
              <ScanIcon size={16} />
            </button>
          </div>
        </div>

        {/* ENS / Address status pills */}
        {ensLoading && <div className="text-xs text-muted-foreground">Resolving ENS…</div>}
        {!ensLoading && ensAddress && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-mono">
            <CheckIcon size={12} />
            <span>Resolved: {shortAddress(ensAddress)}</span>
          </div>
        )}
        {ensError && <div className="text-xs text-rose-500 font-medium">{ensError}</div>}

        {/* Recent contacts chips */}
        {contacts.length > 0 && (
          <div className="pt-1 flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] text-muted-foreground shrink-0">Recent:</span>
            {contacts.slice(0, 4).map((c) => (
              <button
                key={c.address}
                type="button"
                onClick={() => setTo(c.address)}
                className="ui-contact-chip"
              >
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Amount Container */}
      <div className="ui-card p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Amount</span>
          {tokenPrice != null && (
            <button
              type="button"
              onClick={() => setUnit(unit === 'token' ? 'usd' : 'token')}
              className="text-primary hover:underline lowercase font-normal"
            >
              Switch to {unit === 'token' ? 'USD' : selectedToken?.symbol}
            </button>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-2xl font-bold bg-transparent border-b border-border py-1 px-0 focus:outline-none focus:border-primary tracking-tight font-mono"
          />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
            {unit === 'token' ? selectedToken?.symbol : 'USD'}
          </div>
        </div>

        {/* Balance & percentage chips */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            Available: {selectedToken ? formatAmount(selectedToken.balance, selectedToken.decimals) : '0.00'}{' '}
            {selectedToken?.symbol}
          </span>
          <div className="flex items-center gap-1">
            {PCTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPct(p)}
                className="ui-pill-btn"
              >
                {p}%
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectedToken && setAmount(formatAmount(selectedToken.balance, selectedToken.decimals))}
              className="ui-pill-btn font-semibold"
            >
              MAX
            </button>
          </div>
        </div>
      </div>

      {/* Fee Speed Tiers */}
      <div className="ui-card p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <FuelIcon size={14} />
          <span>Network Speed & Fee</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FEE_TIERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFeeTier(f.id)}
              className={`p-2 rounded-xl text-center border transition-all ${
                feeTier === f.id
                  ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              <div className="text-xs font-bold">{f.name}</div>
              <div className="text-[10px] text-muted-foreground">{f.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation Done Alert */}
      {done && (
        <Alert>
          <AlertTitle>Transaction sent ✓</AlertTitle>
          <AlertDescription className="ui-mono text-xs">{done}</AlertDescription>
        </Alert>
      )}

      {/* Action CTA Button */}
      <div className="pt-2">
        <Button
          size="lg"
          block
          disabled={!canReview}
          onClick={() => setConfirm(true)}
          className="ui-btn-glow"
        >
          {sendError ?? 'Review Send'}
        </Button>
      </div>

      {/* QR Scanner modal */}
      {scanOpen && (
        <QrScanner
          hint="Point at Ethereum address QR"
          onScan={(raw) => {
            setScanOpen(false)
            const parsedAddr = parseScannedPayload(raw)
            if (parsedAddr) setTo(parsedAddr)
            else setTo(raw.trim())
          }}
          onClose={() => setScanOpen(false)}
        />
      )}

      {/* Token Select Sheet */}
      <TokenSelectSheet
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        tokens={selectableTokens}
        selectedToken={selectedToken}
        onSelect={(t) => {
          setSelectedToken(t)
          setAmount('')
        }}
      />

      {/* TapToSign Sheet */}
      {selectedToken && effectiveTo && parsed != null && (
        <TapToSign
          open={confirm}
          title="Confirm Send"
          chainId={selectedToken.chainId}
          lines={[
            { k: 'Amount', v: `${amount.trim()} ${selectedToken.symbol}` },
            { k: 'To', v: shortAddress(effectiveTo) },
            { k: 'Full Address', v: effectiveTo },
            { k: 'Network', v: selectedChain.chain.name },
            { k: 'Speed', v: feeTier.toUpperCase() },
          ]}
          buildTx={async () => {
            if (!session) throw new Error('Unlock card first.')
            if (selectedToken.contractAddress === 'native') {
              return {
                to: effectiveTo,
                value: parsed,
                data: '0x' as `0x${string}`,
              }
            }
            return {
              to: selectedToken.contractAddress as `0x${string}`,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [effectiveTo, parsed],
              }),
              value: 0n,
            }
          }}
          onDone={(h) => {
            setDone(h)
            setConfirm(false)
            setAmount('')
            setTo('')
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
