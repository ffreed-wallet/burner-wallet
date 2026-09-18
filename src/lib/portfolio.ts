/**
 * Portfolio data layer.
 * Primary: Alchemy Token/NFT/Transfers/Prices APIs (free tier key).
 * Fallback (no key / rate-limited): keyless public JSON-RPC + Multicall3 for
 * native balances, CoinGecko demo API for prices, Blockscout for history.
 */

export interface TokenBalance {
  contractAddress: `0x${string}` | 'native'
  symbol: string
  name: string
  decimals: number
  balance: bigint
  logo?: string
  chainId: number
  priceUsd?: number
}

export interface NftItem {
  contract: `0x${string}`
  tokenId: string
  chainId: number
  name?: string
  collection?: string
  image?: string
  tokenType: 'ERC721' | 'ERC1155' | string
  isSpam?: boolean
}

export interface ActivityItem {
  hash: `0x${string}`
  chainId: number
  from: string
  to: string
  value: string
  asset: string
  category: string
  timestamp?: string
  status: 'confirmed' | 'pending' | 'failed'
  /** Token contract for erc20/erc721/erc1155 transfers (rawContract.address). */
  contract?: string
}

const alchemyKey = () =>
  (import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined)?.trim()

function alchemyBase(chainId: number): string | null {
  const key = alchemyKey()
  if (!key) return null
  const hosts: Record<number, string> = {
    1: 'eth-mainnet',
    8453: 'base-mainnet',
    137: 'polygon-mainnet',
    10: 'opt-mainnet',
    42161: 'arb-mainnet',
    11155111: 'eth-sepolia',
    84532: 'base-sepolia',
  }
  const slug = hosts[chainId]
  return slug ? `https://${slug}.g.alchemy.com/v2/${key}` : null
}

/** ERC-20 balances for an address on one chain. */
export async function fetchTokenBalances(
  address: `0x${string}`,
  chainId: number,
): Promise<TokenBalance[]> {
  const rpc = alchemyBase(chainId)
  if (!rpc) return []
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenBalances',
      params: [address, 'erc20'],
    }),
  })
  if (!res.ok) throw new Error(`token balances HTTP ${res.status}`)
  const json = (await res.json()) as {
    result?: { tokenBalances?: { contractAddress: string; tokenBalance: string }[] }
  }
  const list = (json.result?.tokenBalances ?? []).filter(
    (t) => t.tokenBalance !== '0x0' && !t.tokenBalance.startsWith('0x00000000'),
  )
  const out: TokenBalance[] = []
  for (const t of list.slice(0, 100)) {
    const meta = await fetchTokenMetadata(t.contractAddress, chainId).catch(
      () => null,
    )
    out.push({
      contractAddress: t.contractAddress as `0x${string}`,
      symbol: meta?.symbol ?? '???',
      name: meta?.name ?? t.contractAddress,
      decimals: meta?.decimals ?? 18,
      balance: BigInt(t.tokenBalance),
      logo: meta?.logo,
      chainId,
    })
  }
  return out
}

async function fetchTokenMetadata(contract: string, chainId: number) {
  const rpc = alchemyBase(chainId)
  if (!rpc) return null
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenMetadata',
      params: [contract],
    }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    result?: { name?: string; symbol?: string; decimals?: number; logo?: string }
  }
  return json.result ?? null
}

/** NFTs owned by an address on one chain (with spam classification). */
export async function fetchNfts(
  address: `0x${string}`,
  chainId: number,
): Promise<NftItem[]> {
  const key = alchemyKey()
  if (!key) return []
  const hosts: Record<number, string> = {
    1: 'eth-mainnet',
    8453: 'base-mainnet',
    137: 'polygon-mainnet',
    10: 'opt-mainnet',
    42161: 'arb-mainnet',
  }
  const slug = hosts[chainId]
  if (!slug) return []
  const url = `https://${slug}.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=50`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`nfts HTTP ${res.status}`)
  const json = (await res.json()) as {
    ownedNfts?: {
      contract: { address: string }
      tokenId: string
      name?: string
      collection?: { name?: string }
      image?: { cachedUrl?: string; thumbnailUrl?: string }
      tokenType?: string
    }[]
    spamInfo?: { isSpam?: string }[]
  }
  return (json.ownedNfts ?? []).map((n, i) => ({
    contract: n.contract.address as `0x${string}`,
    tokenId: n.tokenId,
    chainId,
    name: n.name,
    collection: n.collection?.name,
    image: n.image?.cachedUrl ?? n.image?.thumbnailUrl,
    tokenType: n.tokenType ?? 'ERC721',
    isSpam:
      json.spamInfo?.[i]?.isSpam === 'true' ||
      /airdrop|claim|free mint|\.xyz$/i.test(n.collection?.name ?? ''),
  }))
}

/** Transfer history for an address on one chain. */
export async function fetchActivity(
  address: `0x${string}`,
  chainId: number,
): Promise<ActivityItem[]> {
  const rpc = alchemyBase(chainId)
  if (!rpc) return []
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toAddress: address,
          category: ['external', 'erc20', 'erc721', 'erc1155'],
          maxCount: '0x32',
          order: 'desc',
          withMetadata: true,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`activity HTTP ${res.status}`)
  const json = (await res.json()) as {
    result?: {
      transfers?: {
        hash: string
        from: string
        to: string
        value?: number
        asset?: string
        category?: string
        rawContract?: { address?: string }
        metadata?: { blockTimestamp?: string }
      }[]
    }
  }
  return (json.result?.transfers ?? []).map((t) => ({
    hash: t.hash as `0x${string}`,
    chainId,
    from: t.from,
    to: t.to ?? address,
    value: String(t.value ?? 0),
    asset: t.asset ?? 'ETH',
    category: t.category ?? 'external',
    timestamp: t.metadata?.blockTimestamp,
    status: 'confirmed' as const,
    ...(t.rawContract?.address ? { contract: t.rawContract.address } : {}),
  }))
}

/** Spot prices via Alchemy Prices API, CoinGecko demo as fallback. */
export async function fetchPrices(
  symbols: string[],
): Promise<Record<string, number>> {
  const key = alchemyKey()
  if (key) {
    try {
      const res = await fetch(
        `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol?symbols=${symbols.join(',')}`,
      )
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { symbol: string; prices?: { value?: string }[] }[]
        }
        const out: Record<string, number> = {}
        for (const d of json.data ?? []) {
          const v = Number(d.prices?.[0]?.value ?? NaN)
          if (Number.isFinite(v)) out[d.symbol.toUpperCase()] = v
        }
        if (Object.keys(out).length > 0) return out
      }
    } catch {
      /* fall through to CoinGecko */
    }
  }
  // CoinGecko demo (free, attribution required, rate-limited)
  const ids: Record<string, string> = {
    ETH: 'ethereum',
    MATIC: 'matic-network',
    POL: 'matic-network',
    OP: 'optimism',
    ARB: 'arbitrum',
    USDC: 'usd-coin',
    USDT: 'tether',
    DAI: 'dai',
    WBTC: 'wrapped-bitcoin',
  }
  const wanted = symbols
    .map((s) => ids[s.toUpperCase()])
    .filter(Boolean)
    .join(',')
  if (!wanted) return {}
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${wanted}&vs_currencies=usd`,
  )
  if (!res.ok) return {}
  const json = (await res.json()) as Record<string, { usd?: number }>
  const out: Record<string, number> = {}
  for (const [sym, id] of Object.entries(ids)) {
    const v = json[id]?.usd
    if (typeof v === 'number') out[sym] = v
  }
  return out
}
