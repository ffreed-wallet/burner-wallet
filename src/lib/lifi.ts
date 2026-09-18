/**
 * Cross-chain swap via LI.FI (Jumper) aggregator — no API key required.
 * Docs: https://docs.li.fi
 *
 * Single-tap flow: one transaction on the source chain, LI.FI routes
 * bridge + destination swap. ERC-20s may need a prior approval tx.
 */

export const LIFI_API = 'https://li.quest/v1'
export const LIFI_INTEGRATOR = 'burner-wallet'
export const NATIVE_ZERO = '0x0000000000000000000000000000000000000000'

/** Map our 'native' sentinel to LI.FI's zero-address convention. */
export function lifiTokenAddress(addr: `0x${string}` | 'native'): string {
  return addr === 'native' ? NATIVE_ZERO : String(addr)
}

export interface LifiQuoteParams {
  fromChain: number
  toChain: number
  fromToken: `0x${string}` | 'native'
  toToken: `0x${string}` | 'native'
  /** Amount in smallest unit, as decimal string. */
  fromAmount: string
  fromAddress: `0x${string}`
  toAddress?: `0x${string}`
  /** 0.005 = 0.5% */
  slippage?: number
  /** Tool allowlist — undefined = any bridge/DEX. */
  allowBridges?: string[]
  denyBridges?: string[]
}

export interface LifiQuote {
  estimate: {
    fromAmount: string
    fromAmountUSD?: string
    toAmount: string
    toAmountUSD?: string
    approvalAddress?: `0x${string}`
    executionDuration?: number
    feeCosts?: { name: string; amountUSD?: string }[]
    gasCosts?: { amountUSD?: string }[]
  }
  transactionRequest?: {
    to: `0x${string}`
    data: `0x${string}`
    value?: string
    gasLimit?: string
    gasPrice?: string
  }
  toolDetails?: { name?: string; key?: string; logoImageUrl?: string }
  includedSteps?: { toolDetails?: { name?: string } }[]
}

export async function fetchLifiQuote(p: LifiQuoteParams, signal?: AbortSignal): Promise<LifiQuote> {
  const q = new URLSearchParams({
    fromChain: String(p.fromChain),
    toChain: String(p.toChain),
    fromToken: lifiTokenAddress(p.fromToken),
    toToken: lifiTokenAddress(p.toToken),
    fromAmount: p.fromAmount,
    fromAddress: p.fromAddress,
    integrator: LIFI_INTEGRATOR,
    slippage: String(p.slippage ?? 0.005),
  })
  if (p.toAddress) q.set('toAddress', p.toAddress)
  if (p.allowBridges?.length) q.set('allowBridges', p.allowBridges.join(','))
  if (p.denyBridges?.length) q.set('denyBridges', p.denyBridges.join(','))

  const res = await fetch(`${LIFI_API}/quote?${q}`, { signal })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      const msg = (body as { message?: string })?.message
      if (msg) detail = ` — ${msg.slice(0, 220)}`
    } catch {
      try {
        const t = await res.text()
        if (t) detail = ` — ${t.slice(0, 220)}`
      } catch {
        /* ignore */
      }
    }
    throw new Error(`Bridge quote failed (${res.status})${detail}`)
  }
  return (await res.json()) as LifiQuote
}

/** Human ETA like "~2 min". LI.FI reports seconds. */
export function formatBridgeEta(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s`
  const m = Math.round(seconds / 60)
  if (m < 60) return `~${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `~${h}h ${rest}m` : `~${h}h`
}

/** Route label e.g. "Across + Uniswap" from included steps. */
export function lifiRouteLabel(q: LifiQuote | null): string | null {
  if (!q) return null
  const steps = (q.includedSteps ?? [])
    .map((s) => s.toolDetails?.name)
    .filter((n): n is string => Boolean(n))
  const uniq = [...new Set(steps)]
  if (uniq.length > 0) return uniq.slice(0, 3).join(' + ')
  return q.toolDetails?.name ?? null
}

/** LI.FI status-tracker URL for a source tx hash. */
export function lifiScanUrl(txHash: string): string {
  return `https://scan.li.fi/tx/${txHash}`
}
