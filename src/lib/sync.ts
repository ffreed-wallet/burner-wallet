import { createPublicClient, erc20Abi, http, type Address } from 'viem'
import { allChains, rpcUrl } from './chains'
import { fetchContractPrices } from './coingecko'
import {
  fetchActivity,
  fetchNfts,
  fetchPrices,
  fetchTokenBalances,
  type ActivityItem,
  type NftItem,
  type TokenBalance,
} from './portfolio'
import { tokenLogo, tokenMeta } from './tokenLists'

export interface Portfolio {
  tokens: TokenBalance[]
  nfts: NftItem[]
  activity: ActivityItem[]
  prices: Record<string, number>
}

/** Refresh everything for an address across enabled chains. */
export async function syncPortfolio(
  address: Address,
  opts: {
    showTestnets: boolean
    enabledChains: number[] | null
    tracked?: { chainId: number; address: string }[]
  },
): Promise<Portfolio> {
  const chains = allChains(opts.showTestnets).filter(
    (c) => !opts.enabledChains || opts.enabledChains.includes(c.chain.id),
  )
  const tokens: TokenBalance[] = []
  const nfts: NftItem[] = []
  const activity: ActivityItem[] = []

  await Promise.all(
    chains.map(async (entry) => {
      const id = entry.chain.id
      // Native balance via RPC (works keyless).
      try {
        const client = createPublicClient({
          chain: entry.chain,
          transport: http(rpcUrl(entry)),
        })
        const bal = await client.getBalance({ address })
        if (bal > 0n) {
          tokens.push({
            contractAddress: 'native',
            symbol: entry.chain.nativeCurrency.symbol,
            name: entry.chain.nativeCurrency.name,
            decimals: entry.chain.nativeCurrency.decimals,
            balance: bal,
            chainId: id,
          })
        }
      } catch {
        /* chain offline — skip */
      }
      // Alchemy-backed data (no-op without key).
      const [tb, nn, ac] = await Promise.all([
        fetchTokenBalances(address, id).catch(() => []),
        fetchNfts(address, id).catch(() => []),
        fetchActivity(address, id).catch(() => []),
      ])
      tokens.push(...tb)
      nfts.push(...nn)
      activity.push(...ac)
    }),
  )

  // Watched ERC-20s: explicit opts.tracked wins, else persisted burner.tracked.
  let tracked: { chainId: number; address: string }[] = opts.tracked ?? []
  if (!opts.tracked) {
    try {
      const raw = JSON.parse(localStorage.getItem('burner.tracked') ?? '[]') as {
        chainId: number
        address: string
      }[]
      if (Array.isArray(raw)) tracked = raw
    } catch {
      tracked = []
    }
  }
  const byChainId = new Map(chains.map((e) => [e.chain.id, e]))
  const fallbackEntries = allChains(true)
  const seen = new Set(
    tokens.map((t) =>
      `${t.chainId}:${t.contractAddress === 'native' ? 'native' : t.contractAddress.toLowerCase()}`,
    ),
  )
  await Promise.all(
    tracked.map(async (t) => {
      try {
        const key = `${t.chainId}:${t.address.toLowerCase()}`
        if (seen.has(key)) return
        seen.add(key)
        const entry =
          byChainId.get(t.chainId) ?? fallbackEntries.find((e) => e.chain.id === t.chainId)
        if (!entry) return
        const meta = tokenMeta(t.chainId, t.address)
        const client = createPublicClient({
          chain: entry.chain,
          transport: http(rpcUrl(entry)),
        })
        const token = t.address as Address
        const [bal, dec, sym] = await Promise.all([
          client
            .readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
            .catch(() => null),
          meta
            ? Promise.resolve(meta.decimals)
            : client
                .readContract({ address: token, abi: erc20Abi, functionName: 'decimals' })
                .catch(() => null),
          meta
            ? Promise.resolve(meta.symbol)
            : client
                .readContract({ address: token, abi: erc20Abi, functionName: 'symbol' })
                .catch(() => null),
        ])
        if (bal == null || dec == null || sym == null) return
        tokens.push({
          contractAddress: t.address as `0x${string}`,
          symbol: meta?.symbol ?? (sym as string),
          name: meta?.name ?? (sym as string),
          decimals: meta?.decimals ?? (dec as number),
          balance: bal as bigint,
          logo: meta?.logoURI ?? tokenLogo(t.chainId, t.address),
          chainId: t.chainId,
        })
      } catch {
        /* skip on any error */
      }
    }),
  )

  // Logo fallback for anything missing one; symbol/name fallback for '???'.
  for (const t of tokens) {
    if (!t.logo && t.contractAddress !== 'native') {
      t.logo = tokenLogo(t.chainId, t.contractAddress)
    }
    if (t.symbol === '???' && t.contractAddress !== 'native') {
      const meta = tokenMeta(t.chainId, t.contractAddress)
      if (meta) {
        t.symbol = meta.symbol
        t.name = meta.name
        if (meta.decimals != null) t.decimals = meta.decimals
        if (!t.logo && meta.logoURI) t.logo = meta.logoURI
      }
    }
  }

  const symbols = [...new Set(tokens.map((t) => t.symbol.toUpperCase()))]
  const prices = await fetchPrices(symbols).catch((): Record<string, number> => ({}))
  // Anything still priceless (tracked customs, long-tail): CoinGecko by contract.
  const byChain = new Map<number, TokenBalance[]>()
  for (const t of tokens) {
    if (t.contractAddress === 'native' || prices[t.symbol.toUpperCase()] != null) continue
    const list = byChain.get(t.chainId) ?? []
    list.push(t)
    byChain.set(t.chainId, list)
  }
  await Promise.all(
    [...byChain.entries()].map(async ([chainId, list]) => {
      const cp = await fetchContractPrices(
        chainId,
        list.map((t) => String(t.contractAddress)),
      ).catch(() => ({} as Record<string, number>))
      for (const t of list) {
        const v = cp[String(t.contractAddress).toLowerCase()]
        if (v != null) prices[`${t.symbol.toUpperCase()}#${t.chainId}`] = v
      }
    }),
  )
  const priced = tokens.map((t) => ({
    ...t,
    priceUsd: prices[t.symbol.toUpperCase()] ?? prices[`${t.symbol.toUpperCase()}#${t.chainId}`],
  }))
  activity.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
  return { tokens: priced, nfts, activity, prices }
}

/** Fiat value of a token balance, null when price unknown. */
export function tokenValueUsd(
  balance: bigint,
  decimals: number,
  priceUsd?: number,
): number | null {
  if (priceUsd == null) return null
  const units = Number(balance) / 10 ** decimals
  return units * priceUsd
}

/** Human amount string, e.g. `1.2345`. */
export function formatAmount(balance: bigint, decimals: number, maxSig = 6): string {
  const neg = balance < 0n
  const abs = neg ? -balance : balance
  const base = 10n ** BigInt(decimals)
  const int = abs / base
  const frac = (abs % base).toString().padStart(decimals, '0').slice(0, maxSig).replace(/0+$/, '')
  return `${neg ? '-' : ''}${int.toString()}${frac ? `.${frac}` : ''}`
}
