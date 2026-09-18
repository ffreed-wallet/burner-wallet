/**
 * Token coverage: Uniswap default token list (the industry-standard majors
 * list) fetched + cached, with a bundled fallback of top tokens per chain
 * so the app works offline/keyless. Powers logos, the popular-tokens
 * picker, and metadata for tracked tokens.
 */

export interface ListedToken {
  chainId: number
  address: `0x${string}`
  name: string
  symbol: string
  decimals: number
  logoURI?: string
}

const UNISWAP_LIST_URL = 'https://tokens.uniswap.org'
const CACHE_KEY = 'burner.tokenlist'
const CACHE_TTL = 24 * 3600e3

/** Bundled majors per chain — always available, no network needed. */
export const BUNDLED_MAJORS: ListedToken[] = [
  // Ethereum
  { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  { chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'Tether', symbol: 'USDT', decimals: 6 },
  { chainId: 1, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', name: 'Dai', symbol: 'DAI', decimals: 18 },
  { chainId: 1, address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  { chainId: 1, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8 },
  { chainId: 1, address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', name: 'Uniswap', symbol: 'UNI', decimals: 18 },
  { chainId: 1, address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', name: 'Chainlink', symbol: 'LINK', decimals: 18 },
  // Base
  { chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4fD71b54bdA02913', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  { chainId: 8453, address: '0x4200000000000000000000000000000000000006', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  { chainId: 8453, address: '0x50c5725949A6F0c72E6C4a641F24049A9179C917', name: 'Dai', symbol: 'DAI', decimals: 18 },
  { chainId: 8453, address: '0x2Ae3F1EC7F1F5012CFEAB0185B6B62416586AA8', name: 'Coinbase ETH', symbol: 'cbETH', decimals: 18 },
  // Polygon
  { chainId: 137, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c335', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  { chainId: 137, address: '0xc2132D05D31c914a87C6611C10748AEb9365d09', name: 'Tether', symbol: 'USDT', decimals: 6 },
  { chainId: 137, address: '0x8f3Cf7ad23Cd3CaDbD9735AFfE7516cB5A68F', name: 'Dai', symbol: 'DAI', decimals: 18 },
  { chainId: 137, address: '0x7ceB23fD933EE0F278f659BD2628dB6cB39D', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  { chainId: 137, address: '0x1BFD67037B42Cf73acFEAa0A47622B31A001', name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8 },
  // Optimism
  { chainId: 10, address: '0x0b2C639c533813f4Aa2cB6C5f0187CC208E427', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  { chainId: 10, address: '0x4200000000000000000000000000000000000042', name: 'Optimism', symbol: 'OP', decimals: 18 },
  { chainId: 10, address: '0x4200000000000000000000000000000000000006', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  { chainId: 10, address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c', name: 'Dai', symbol: 'DAI', decimals: 18 },
  // Arbitrum
  { chainId: 42161, address: '0xaf88d065E77c8cC2239327C5EDb3A432268e5831', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  { chainId: 42161, address: '0x912CE59144191C1204E61A17aC361f0319625', name: 'Arbitrum', symbol: 'ARB', decimals: 18 },
  { chainId: 42161, address: '0x82aF49447D8a11e3bb05ECA045b892F0303B4', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  { chainId: 42161, address: '0xFd086bC7CD5C48154c8eD44eE83A', name: 'Tether', symbol: 'USDT', decimals: 6 },
]

function ipfsToHttp(uri?: string): string | undefined {
  if (!uri) return undefined
  return uri.startsWith('ipfs://') ? uri.replace('ipfs://', 'https://ipfs.io/ipfs/') : uri
}

interface CacheShape {
  at: number
  tokens: ListedToken[]
}

function readCache(): ListedToken[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const c = JSON.parse(raw) as CacheShape
    if (Date.now() - c.at > CACHE_TTL) return []
    return c.tokens
  } catch {
    return []
  }
}

/** Full merged list: Uniswap cache first, bundled always included. */
export function getCachedTokens(): ListedToken[] {
  const cached = readCache()
  const seen = new Set(cached.map((t) => `${t.chainId}:${t.address.toLowerCase()}`))
  const merged = [...cached]
  for (const b of BUNDLED_MAJORS) {
    if (!seen.has(`${b.chainId}:${b.address.toLowerCase()}`)) merged.push(b)
  }
  return merged
}

/** Refresh the Uniswap list in the background (never throws). */
export async function refreshTokenList(): Promise<void> {
  try {
    const res = await fetch(UNISWAP_LIST_URL)
    if (!res.ok) return
    const json = (await res.json()) as {
      tokens?: { chainId: number; address: string; name: string; symbol: string; decimals: number; logoURI?: string }[]
    }
    const tokens: ListedToken[] = (json.tokens ?? [])
      .filter((t) => Number.isInteger(t.chainId) && t.address?.startsWith('0x'))
      .map((t) => ({
        chainId: t.chainId,
        address: t.address as `0x${string}`,
        name: t.name,
        symbol: t.symbol,
        decimals: t.decimals,
        logoURI: ipfsToHttp(t.logoURI),
      }))
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), tokens } satisfies CacheShape))
  } catch {
    /* offline — bundled majors carry us */
  }
}

/** Popular tokens for a chain (bundled first, then cached Uniswap). */
export function getPopularTokens(chainId: number, limit = 12): ListedToken[] {
  const all = getCachedTokens().filter((t) => t.chainId === chainId)
  const bundled = all.filter((t) => BUNDLED_MAJORS.some((b) => b.chainId === chainId && b.address.toLowerCase() === t.address.toLowerCase()))
  const rest = all.filter((t) => !bundled.includes(t))
  return [...bundled, ...rest].slice(0, limit)
}

/** Logo for a contract, if any list knows it. */
export function tokenLogo(chainId: number, address: string): string | undefined {
  const a = address.toLowerCase()
  return getCachedTokens().find((t) => t.chainId === chainId && t.address.toLowerCase() === a)?.logoURI
}

/** Metadata for a contract, if any list knows it. */
export function tokenMeta(chainId: number, address: string): ListedToken | undefined {
  const a = address.toLowerCase()
  return getCachedTokens().find((t) => t.chainId === chainId && t.address.toLowerCase() === a)
}
