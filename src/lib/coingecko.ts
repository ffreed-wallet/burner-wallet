/**
 * CoinGecko free-tier pricing for ARBITRARY tokens by contract address.
 * Covers anything the symbol-based lookup misses (tracked customs, L2
 * natives, long-tail). Cached 10 min to respect demo rate limits.
 */

const PLATFORM: Record<number, string> = {
  1: 'ethereum',
  8453: 'base',
  137: 'polygon-pos',
  10: 'optimistic-ethereum',
  42161: 'arbitrum-one',
}

const CACHE_KEY = 'burner.cgPrices'
const TTL = 10 * 60e3

interface CacheShape {
  at: number
  prices: Record<string, number> // `${chainId}:${address}` → usd
}

function readCache(): CacheShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { at: 0, prices: {} }
    const c = JSON.parse(raw) as CacheShape
    if (Date.now() - c.at > TTL) return { at: 0, prices: {} }
    return c
  } catch {
    return { at: 0, prices: {} }
  }
}

function writeCache(prices: Record<string, number>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), prices } satisfies CacheShape))
  } catch {
    /* private mode */
  }
}

/** USD prices for contract addresses on one chain (keys lowercased). */
export async function fetchContractPrices(
  chainId: number,
  addresses: string[],
): Promise<Record<string, number>> {
  const platform = PLATFORM[chainId]
  const out: Record<string, number> = {}
  if (!platform || addresses.length === 0) return out
  const cache = readCache()
  const missing = addresses
    .map((a) => a.toLowerCase())
    .filter((a) => cache.prices[`${chainId}:${a}`] == null)
  for (const a of addresses.map((x) => x.toLowerCase())) {
    const v = cache.prices[`${chainId}:${a}`]
    if (v != null) out[a] = v
  }
  if (missing.length === 0) return out
  try {
    // simple/token_price batches up to 100 contracts per call
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${missing.slice(0, 100).join(',')}&vs_currencies=usd`,
    )
    if (!res.ok) return out
    const json = (await res.json()) as Record<string, { usd?: number }>
    const merged = { ...cache.prices }
    for (const [addr, v] of Object.entries(json)) {
      if (typeof v.usd === 'number') {
        out[addr.toLowerCase()] = v.usd
        merged[`${chainId}:${addr.toLowerCase()}`] = v.usd
      }
    }
    writeCache(merged)
  } catch {
    /* offline / rate-limited — return what cache had */
  }
  return out
}
