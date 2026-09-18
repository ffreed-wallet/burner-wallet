import type { Chain } from 'viem'
import { arbitrum, base, baseSepolia, mainnet, optimism, polygon, sepolia } from 'viem/chains'

export interface ChainEntry {
  chain: Chain
  alchemySlug: string | null
  publicRpc: string
  explorer: string
  badge: string
}

export interface CustomChain {
  id: number
  name: string
  rpcUrl: string
  explorer: string
  nativeSymbol: string
}

const CUSTOM_CHAINS_KEY = 'burner_custom_chains'

export function loadCustomChains(): CustomChain[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CHAINS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomChains(chains: CustomChain[]): void {
  try {
    localStorage.setItem(CUSTOM_CHAINS_KEY, JSON.stringify(chains))
  } catch {
    /* ignore */
  }
}

export function hasAlchemyKey(): boolean {
  return Boolean(import.meta.env.VITE_ALCHEMY_API_KEY)
}

const DEFAULT_CHAINS: ChainEntry[] = [
  {
    chain: mainnet,
    alchemySlug: 'eth-mainnet',
    publicRpc: 'https://cloudflare-eth.com',
    explorer: 'https://etherscan.io',
    badge: 'ETH',
  },
  {
    chain: base,
    alchemySlug: 'base-mainnet',
    publicRpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    badge: 'BASE',
  },
  {
    chain: polygon,
    alchemySlug: 'polygon-mainnet',
    publicRpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    badge: 'POL',
  },
  {
    chain: optimism,
    alchemySlug: 'opt-mainnet',
    publicRpc: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    badge: 'OP',
  },
  {
    chain: arbitrum,
    alchemySlug: 'arb-mainnet',
    publicRpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    badge: 'ARB',
  },
]

const TESTNET_CHAINS: ChainEntry[] = [
  {
    chain: sepolia,
    alchemySlug: 'eth-sepolia',
    publicRpc: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    badge: 'SEP',
  },
  {
    chain: baseSepolia,
    alchemySlug: 'base-sepolia',
    publicRpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    badge: 'BSEP',
  },
]

export function allChains(includeTestnets = true): ChainEntry[] {
  const customs: ChainEntry[] = loadCustomChains().map((c) => ({
    chain: {
      id: c.id,
      name: c.name,
      nativeCurrency: { name: c.nativeSymbol, symbol: c.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [c.rpcUrl] } },
    } as unknown as Chain,
    alchemySlug: null,
    publicRpc: c.rpcUrl,
    explorer: c.explorer,
    badge: c.nativeSymbol.toUpperCase().slice(0, 6),
  }))
  return [
    ...DEFAULT_CHAINS,
    ...customs,
    ...(includeTestnets ? TESTNET_CHAINS : []),
  ]
}

export function rpcUrl(target: ChainEntry | number): string {
  const entry =
    typeof target === 'number'
      ? allChains(true).find((c) => c.chain.id === target)
      : target
  if (!entry) return 'https://cloudflare-eth.com'
  const key = import.meta.env.VITE_ALCHEMY_API_KEY
  if (key && entry.alchemySlug) {
    return `https://${entry.alchemySlug}.g.alchemy.com/v2/${key}`
  }
  return entry.publicRpc
}

export function explorerTxUrl(chainId: number, hash: string): string | undefined {
  const c = allChains(true).find((entry) => entry.chain.id === chainId)
  if (!c?.explorer) return undefined
  const base = c.explorer.replace(/\/+$/, '')
  return `${base}/tx/${hash}`
}
