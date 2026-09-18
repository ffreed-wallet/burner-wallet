import { createPublicClient, http, type PublicClient } from 'viem'
import { allChains, rpcUrl } from './chains'

/** Fee-speed selector for the TapToSign gas UI. */
export type GasSpeed = 'slow' | 'standard' | 'fast'

export interface FeeEstimate {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  /** Legacy fallback for chains without EIP-1559. */
  gasPrice?: bigint
  nativeSymbol: string
}

export interface GasTxHint {
  account?: `0x${string}`
  to?: `0x${string}`
  data?: `0x${string}`
  value?: bigint
}

/**
 * Live fee estimate for a chain via its configured RPC.
 * Prefers EIP-1559 (estimateFeesPerGas), falls back to getGasPrice.
 * Price lookup is left to the caller (store prices by symbol).
 */
export async function estimateFee(chainId: number): Promise<FeeEstimate> {
  const entry = allChains(true).find((c) => c.chain.id === chainId)
  if (!entry) throw new Error(`Unknown chain ${chainId}`)
  const nativeSymbol = entry.chain.nativeCurrency.symbol
  const client = createPublicClient({
    chain: entry.chain,
    transport: http(rpcUrl(entry)),
  })
  try {
    const fees = await client.estimateFeesPerGas()
    if (fees.maxFeePerGas != null && fees.maxPriorityFeePerGas != null) {
      return {
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        nativeSymbol,
      }
    }
  } catch {
    /* fall through to legacy gas price */
  }
  const gasPrice = await client.getGasPrice()
  return { gasPrice, nativeSymbol }
}

const SPEED_NUM: Record<GasSpeed, { n: bigint; d: bigint }> = {
  slow: { n: 9n, d: 10n },
  standard: { n: 1n, d: 1n },
  fast: { n: 5n, d: 4n },
}

/**
 * Apply a speed multiplier to a base fee estimate.
 * The base fee component is preserved: only the priority fee (or the
 * legacy gas price) is scaled — maxFee = baseFee + scaledPriority.
 */
export function feeForSpeed(
  base: FeeEstimate,
  speed: GasSpeed,
): Pick<FeeEstimate, 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'gasPrice'> {
  const { n, d } = SPEED_NUM[speed]
  const scale = (v: bigint): bigint => (v * n) / d
  if (base.maxFeePerGas != null || base.maxPriorityFeePerGas != null) {
    const priority = base.maxPriorityFeePerGas ?? 0n
    const max = base.maxFeePerGas ?? priority
    const scaledPriority = scale(priority)
    const baseFee = max > priority ? max - priority : 0n
    return {
      maxFeePerGas: baseFee + scaledPriority,
      maxPriorityFeePerGas: scaledPriority,
    }
  }
  return { gasPrice: base.gasPrice != null ? scale(base.gasPrice) : undefined }
}

/** `1234567890n` → `"1.23 GWEI"`. Returns "—" for null/undefined. */
export function formatGwei(v?: bigint | null): string {
  if (v == null) return '—'
  const g = Number(v) / 1e9
  if (!Number.isFinite(g)) return '—'
  const s = g >= 100 ? g.toFixed(1) : g >= 1 ? g.toFixed(2) : g.toFixed(3)
  return `${parseFloat(s).toString()} GWEI`
}

/**
 * Estimate a gas limit with a 1.2x buffer. On RPC failure returns a safe
 * default (21000 for plain transfers, 65000 when calldata is present).
 */
export async function estimateGasLimit(
  client: PublicClient,
  tx: GasTxHint,
): Promise<bigint> {
  const fallback = tx.data && tx.data !== '0x' ? 65000n : 21000n
  try {
    const gas = await client.estimateGas({
      account: tx.account,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    return (gas * 12n) / 10n
  } catch {
    return fallback
  }
}
