import { useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, encodeFunctionData, erc20Abi, formatUnits, http, parseUnits } from 'viem'
import { TapToSign } from '../components/TapToSign'
import { TokenIcon } from '../components/TokenIcon'
import { TokenSelectSheet, type SelectableToken } from '../components/TokenSelectSheet'
import { allChains, rpcUrl, type ChainEntry } from '../lib/chains'
import type { TokenBalance } from '../lib/portfolio'
import {
  fetchLifiQuote,
  formatBridgeEta,
  lifiRouteLabel,
  lifiScanUrl,
  type LifiQuote,
} from '../lib/lifi'
import { fetchContractPrices } from '../lib/coingecko'
import { fetchPrices } from '../lib/portfolio'
import { formatAmount } from '../lib/sync'
import { BUNDLED_MAJORS, getCachedTokens } from '../lib/tokenLists'
import { useWallet } from '../store'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ChevronDownIcon, SwapArrowsIcon, FuelIcon } from '../components/ui/icons'

const SLIPS = [0.1, 0.5, 1.0] as const
const ZEROX_NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const MAX_UINT = (1n << 256n) - 1n

/** Price lookup with WETH→ETH spot alias (backends may only return ETH). */
function lookupPrice(prices: Record<string, number>, symbol: string): number | undefined {
  const sym = symbol.toUpperCase()
  return prices[sym] ?? (sym === 'WETH' ? prices['ETH'] : undefined)
}

/** All selectable tokens (owned + majors) for one chain. */
function tokensForChain(
  chainId: number,
  entry: ChainEntry | undefined,
  owned: TokenBalance[],
  prices: Record<string, number>,
): SelectableToken[] {
  if (!entry) return []
  const list: SelectableToken[] = []
  const seen = new Set<string>()

  const nativeSym = entry.chain.nativeCurrency.symbol.toUpperCase()
  const ownedNative = owned.find((t) => t.chainId === chainId && t.contractAddress === 'native')
  list.push({
    chainId,
    contractAddress: 'native',
    symbol: nativeSym,
    name: entry.chain.nativeCurrency.name,
    decimals: entry.chain.nativeCurrency.decimals,
    balance: ownedNative?.balance ?? 0n,
    priceUsd: ownedNative?.priceUsd ?? lookupPrice(prices, nativeSym),
    isOwned: (ownedNative?.balance ?? 0n) > 0n,
  })
  seen.add('native')

  for (const t of owned) {
    if (t.chainId !== chainId) continue
    const key = String(t.contractAddress).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    list.push({
      chainId: t.chainId,
      contractAddress: t.contractAddress,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      balance: t.balance,
      priceUsd: t.priceUsd ?? lookupPrice(prices, t.symbol),
      logo: t.logo,
      isOwned: t.balance > 0n,
    })
  }

  const allKnown = [...BUNDLED_MAJORS, ...getCachedTokens()]
  for (const k of allKnown) {
    if (k.chainId !== chainId) continue
    const key = k.address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    list.push({
      chainId: k.chainId,
      contractAddress: k.address,
      symbol: k.symbol,
      name: k.name,
      decimals: k.decimals,
      balance: 0n,
      priceUsd: lookupPrice(prices, k.symbol),
      logo: k.logoURI,
      isOwned: false,
    })
  }

  return list.sort((a, b) => {
    const val = (t: SelectableToken) =>
      t.priceUsd != null && t.balance > 0n
        ? (Number(t.balance) / 10 ** t.decimals) * t.priceUsd
        : 0
    const d = val(b) - val(a)
    if (d !== 0) return d
    if (a.isOwned !== b.isOwned) return a.isOwned ? -1 : 1
    return a.symbol.localeCompare(b.symbol)
  })
}

export function Swap() {
  const { session, tokens, settings, updateSettings, prices } = useWallet()

  const [fromChainId, setFromChainId] = useState(1)
  const [toChainId, setToChainId] = useState(1)
  const [fromToken, setFromToken] = useState<SelectableToken | null>(null)
  const [toToken, setToToken] = useState<SelectableToken | null>(null)
  const [amount, setAmount] = useState('')
  const [selectorTarget, setSelectorTarget] = useState<'from' | 'to' | null>(null)
  const [customSlip, setCustomSlip] = useState('')
  const [isCustomSlip, setIsCustomSlip] = useState(false)
  const [invertRate, setInvertRate] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  // Bridge quote state (LI.FI)
  const [quote, setQuote] = useState<LifiQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [approvalAddr, setApprovalAddr] = useState<`0x${string}` | null>(null)

  // On-demand prices for swap pairs. Portfolio `prices` only covers owned
  // symbols, so an unowned destination token (e.g. USDC you don't hold yet)
  // would otherwise have no price → no estimate, no USD, no rate.
  const [swapPrices, setSwapPrices] = useState<Record<string, number>>({})
  const [swapContractPrices, setSwapContractPrices] = useState<Record<string, number>>({})
  const inflightSymsRef = useRef<Set<string>>(new Set())
  const inflightContractsRef = useRef<Set<string>>(new Set())
  const fetchedContractsRef = useRef<Set<string>>(new Set())

  const mergedPrices = useMemo(
    () => ({ ...prices, ...swapPrices }),
    [prices, swapPrices],
  )

  const priceOf = (t: SelectableToken | null | undefined): number | undefined => {
    if (!t) return undefined
    if (t.priceUsd != null) return t.priceUsd
    const sym = t.symbol.toUpperCase()
    return (
      lookupPrice(mergedPrices, sym) ??
      (t.contractAddress !== 'native'
        ? swapContractPrices[`${t.chainId}:${String(t.contractAddress).toLowerCase()}`]
        : undefined)
    )
  }

  // Single UI: the route is derived from the chosen networks.
  // Same network → same-chain swap (0x), different networks → bridge (LI.FI).
  const isBridge = fromChainId !== toChainId

  const chains = useMemo(() => allChains(true), [])
  const chainMap = useMemo(() => new Map(chains.map((c) => [c.chain.id, c] as const)), [chains])
  const fromChain = chainMap.get(fromChainId) ?? chains[0]
  const toChain = chainMap.get(toChainId) ?? chains[1] ?? chains[0]

  const fromList = useMemo(
    () => tokensForChain(fromChainId, chainMap.get(fromChainId), tokens, mergedPrices),
    [fromChainId, chainMap, tokens, mergedPrices],
  )
  const toList = useMemo(
    () => tokensForChain(toChainId, chainMap.get(toChainId), tokens, mergedPrices),
    [toChainId, chainMap, tokens, mergedPrices],
  )
  // Sheet always sees both sides so in-sheet chain switching works.
  // (Same network on both sides → single list, no duplicates.)
  const sheetTokens = useMemo(
    () => (fromChainId === toChainId ? fromList : [...fromList, ...toList]),
    [fromChainId, toChainId, fromList, toList],
  )

  // Sensible from-default: richest owned token on the source chain.
  useEffect(() => {
    if (fromList.length === 0) return
    setFromToken((prev) => {
      if (prev && prev.chainId === fromChainId) {
        const refresh = fromList.find(
          (t) => String(t.contractAddress).toLowerCase() === String(prev.contractAddress).toLowerCase(),
        )
        return refresh ?? prev
      }
      return fromList.find((t) => t.balance > 0n) ?? fromList[0]
    })
  }, [fromList, fromChainId])

  // Sensible to-default: USDC (or first different token) on dest chain.
  useEffect(() => {
    if (toList.length === 0) return
    setToToken((prev) => {
      if (prev && prev.chainId === toChainId) {
        const refresh = toList.find(
          (t) => String(t.contractAddress).toLowerCase() === String(prev.contractAddress).toLowerCase(),
        )
        return refresh ?? prev
      }
      const fromAddr = fromToken ? String(fromToken.contractAddress).toLowerCase() : null
      const fromIsSameChain = fromToken?.chainId === toChainId
      return (
        toList.find(
          (t) =>
            t.symbol.toUpperCase() === 'USDC' &&
            !(fromIsSameChain && String(t.contractAddress).toLowerCase() === fromAddr),
        ) ??
        toList.find(
          (t) => !(fromIsSameChain && String(t.contractAddress).toLowerCase() === fromAddr),
        ) ??
        toList[0] ??
        null
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toList, toChainId])

  const handleFromChain = (id: number) => {
    setFromChainId(id)
    setAmount('')
    setQuote(null)
    setQuoteError(null)
    setNeedsApproval(false)
    setFromToken(null)
  }

  // Fetch missing spot prices for the visible swap lists (owned-only
  // portfolio prices leave unowned majors priceless). Symbol lookup first,
  // then per-contract CoinGecko fallback for long-tail tokens.
  // NOTE: StrictMode double-mounts effects in dev, so results are never
  // discarded on cleanup and symbols are only marked fetched after success —
  // otherwise the first fetch is dropped and the retry is skipped.
  useEffect(() => {
    const candidates = [...fromList, ...toList].filter((t) => priceOf(t) == null)
    if (candidates.length === 0) return
    const syms = [...new Set(candidates.map((t) => t.symbol.toUpperCase()))].filter(
      (s) => s && mergedPrices[s] == null && !inflightSymsRef.current.has(s),
    )
    // Also always ensure the two selected tokens are covered (flip-safe).
    for (const t of [fromToken, toToken]) {
      const s = t?.symbol.toUpperCase()
      if (s && priceOf(t) == null && mergedPrices[s] == null && !inflightSymsRef.current.has(s) && !syms.includes(s)) {
        syms.push(s)
      }
    }
    if (syms.length === 0) return
    for (const s of syms) inflightSymsRef.current.add(s)
    void (async () => {
      // Local view of known prices so the contract fallback below doesn't
      // refetch symbols this batch just resolved (closure mergedPrices is stale).
      const known: Record<string, number> = { ...mergedPrices }
      try {
        const res = await fetchPrices(syms)
        const fresh: Record<string, number> = {}
        for (const [k, v] of Object.entries(res)) {
          if (Number.isFinite(v)) fresh[k.toUpperCase()] = v
        }
        // WETH alias: if backend only priced ETH, mirror it.
        if (fresh['ETH'] != null && fresh['WETH'] == null) fresh['WETH'] = fresh['ETH']
        if (Object.keys(fresh).length > 0) {
          Object.assign(known, fresh)
          setSwapPrices((prev) => ({ ...prev, ...fresh }))
        }
      } catch {
        /* offline — leave estimate empty */
      } finally {
        for (const s of syms) inflightSymsRef.current.delete(s)
      }
      // Contract fallback for anything still priceless.
      try {
        const still = candidates.filter((t) => {
          const sym = t.symbol.toUpperCase()
          if (t.priceUsd != null) return false
          if (known[sym] != null) return false
          if (sym === 'WETH' && known['ETH'] != null) return false
          if (t.contractAddress === 'native') return false
          const key = `${t.chainId}:${String(t.contractAddress).toLowerCase()}`
          if (fetchedContractsRef.current.has(key) || inflightContractsRef.current.has(key)) return false
          return true
        })
        const byChain = new Map<number, string[]>()
        for (const t of still) {
          const key = `${t.chainId}:${String(t.contractAddress).toLowerCase()}`
          inflightContractsRef.current.add(key)
          const list = byChain.get(t.chainId) ?? []
          list.push(String(t.contractAddress))
          byChain.set(t.chainId, list)
        }
        for (const [chainId, addrs] of byChain) {
          try {
            const cp = await fetchContractPrices(chainId, addrs)
            const fresh: Record<string, number> = {}
            for (const [addr, v] of Object.entries(cp)) {
              if (Number.isFinite(v)) fresh[`${chainId}:${addr.toLowerCase()}`] = v
            }
            if (Object.keys(fresh).length > 0) {
              setSwapContractPrices((prev) => ({ ...prev, ...fresh }))
            }
          } finally {
            for (const a of addrs) {
              const key = `${chainId}:${a.toLowerCase()}`
              inflightContractsRef.current.delete(key)
              fetchedContractsRef.current.add(key)
            }
          }
        }
      } catch {
        /* ignore */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromList, toList, fromToken, toToken])

  const handleToChain = (id: number) => {
    setToChainId(id)
    setQuote(null)
    setQuoteError(null)
    setNeedsApproval(false)
    setToToken(null)
  }

  const flip = () => {
    if (!fromToken || !toToken) return
    const fc = fromChainId
    setFromChainId(toChainId)
    setToChainId(fc)
    setFromToken({ ...toToken })
    setToToken({ ...fromToken })
    // Keep the typed amount so the estimate/price stays visible — it is
    // simply re-quoted in the opposite direction.
    setQuote(null)
    setQuoteError(null)
    setNeedsApproval(false)
  }

  // ---- Amount parsing & validation ----
  const parsedSellAmount = useMemo(() => {
    if (!fromToken || !amount.trim()) return null
    try {
      const clean = amount.trim().replace(/,/g, '')
      if (!clean || clean === '.' || isNaN(Number(clean))) return null
      return parseUnits(clean, fromToken.decimals)
    } catch {
      return null
    }
  }, [fromToken, amount])

  const amtNum = Number(amount.trim().replace(/,/g, ''))
  const isAmtValid = parsedSellAmount != null && parsedSellAmount > 0n
  const exceedsBalance =
    isAmtValid && fromToken != null ? parsedSellAmount! > fromToken.balance : false

  const sameToken =
    fromToken != null &&
    toToken != null &&
    fromToken.chainId === toToken.chainId &&
    String(fromToken.contractAddress).toLowerCase() === String(toToken.contractAddress).toLowerCase()

  // ---- Bridge quote (debounced) ----
  const quoteKey = isBridge && isAmtValid && fromToken && toToken && session
    ? `${fromChainId}:${String(fromToken.contractAddress)}:${toChainId}:${String(toToken.contractAddress)}:${parsedSellAmount!.toString()}:${session.address}:${settings.slippage}`
    : null
  const quoteKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!quoteKey || !fromToken || !toToken || !session || !isAmtValid) {
      setQuote(null)
      setQuoteLoading(false)
      if (!quoteKey) setQuoteError(null)
      return
    }
    if (quoteKeyRef.current === quoteKey) return
    quoteKeyRef.current = quoteKey
    let cancelled = false
    setQuoteLoading(true)
    setQuoteError(null)
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = await fetchLifiQuote({
            fromChain: fromChainId,
            toChain: toChainId,
            fromToken: fromToken.contractAddress,
            toToken: toToken.contractAddress,
            fromAmount: parsedSellAmount!.toString(),
            fromAddress: session.address as `0x${string}`,
            toAddress: session.address as `0x${string}`,
            slippage: (Number.isFinite(settings.slippage) ? settings.slippage : 0.5) / 100,
          })
          if (!cancelled) {
            setQuote(q)
            setQuoteLoading(false)
          }
        } catch (e) {
          if (!cancelled) {
            setQuote(null)
            setQuoteLoading(false)
            setQuoteError(e instanceof Error ? e.message : 'Bridge quote failed.')
          }
        }
      })()
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey])

  // ---- ERC-20 allowance check for the bridge spender ----
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setNeedsApproval(false)
      setApprovalAddr(null)
      if (!isBridge || !quote || !fromToken || !session || !isAmtValid) return
      if (fromToken.contractAddress === 'native') return
      const spender = quote.estimate?.approvalAddress
      if (!spender) return
      try {
        const entry = chainMap.get(fromChainId)
        if (!entry) return
        const client = createPublicClient({ chain: entry.chain, transport: http(rpcUrl(entry)) })
        const allowance = await client.readContract({
          address: fromToken.contractAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [session.address as `0x${string}`, spender],
        })
        if (!cancelled) {
          setApprovalAddr(spender)
          setNeedsApproval(allowance < parsedSellAmount!)
        }
      } catch {
        /* allowance unknown — let execution reveal it */
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isBridge, quote, fromToken, session, isAmtValid, parsedSellAmount, fromChainId, chainMap])

  // ---- Derived pricing ----
  const fromPriceUsd = useMemo(() => priceOf(fromToken), [fromToken, mergedPrices, swapContractPrices])
  const toPriceUsd = useMemo(() => priceOf(toToken), [toToken, mergedPrices, swapContractPrices])
  const fromUsd =
    isAmtValid && fromPriceUsd != null ? amtNum * fromPriceUsd : null

  const priceRate = useMemo(() => {
    if (fromPriceUsd == null || toPriceUsd == null || toPriceUsd === 0) return null
    return fromPriceUsd / toPriceUsd
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPriceUsd, toPriceUsd])

  const bridgeReceive = useMemo(() => {
    if (!isBridge || !quote || !toToken) return null
    try {
      return Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals))
    } catch {
      return null
    }
  }, [isBridge, quote, toToken])

  const priceReceive = useMemo(() => {
    if (!isAmtValid || priceRate == null) return null
    return amtNum * priceRate
  }, [isAmtValid, priceRate, amtNum])

  const estimatedReceive = isBridge ? (bridgeReceive ?? priceReceive) : priceReceive
  const exchangeRate = isBridge && bridgeReceive != null && isAmtValid
    ? bridgeReceive / amtNum
    : priceRate

  const bridgeToUsd = quote?.estimate?.toAmountUSD != null ? Number(quote.estimate.toAmountUSD) : null
  const toUsd = bridgeToUsd ?? (estimatedReceive != null && toPriceUsd != null
    ? estimatedReceive * toPriceUsd
    : null)

  const routeLabel = isBridge ? lifiRouteLabel(quote) : null
  const etaLabel = isBridge && quote ? formatBridgeEta(quote.estimate?.executionDuration) : null
  const feeUsd = useMemo(() => {
    if (!isBridge || !quote) return null
    let total = 0
    let known = false
    for (const f of quote.estimate?.feeCosts ?? []) {
      const v = Number(f.amountUSD ?? NaN)
      if (Number.isFinite(v)) {
        total += v
        known = true
      }
    }
    for (const g of quote.estimate?.gasCosts ?? []) {
      const v = Number(g.amountUSD ?? NaN)
      if (Number.isFinite(v)) {
        total += v
        known = true
      }
    }
    return known ? total : null
  }, [isBridge, quote])

  const swapError = !fromToken
    ? 'Select a token to pay with'
    : !toToken
      ? 'Select a token to receive'
      : sameToken
        ? 'Select different tokens to swap'
        : !amount.trim()
          ? null
          : !isAmtValid
            ? 'Enter a valid amount'
            : exceedsBalance
              ? `Insufficient ${fromToken.symbol} balance`
              : null

  const canReview = !!fromToken && !!toToken && isAmtValid && !exceedsBalance && !sameToken
  const bridgeBlocked = isBridge && quoteError != null && bridgeReceive == null
  const reviewDisabled = !canReview || (isBridge && (quoteLoading || bridgeBlocked))

  const zeroXKey = (import.meta.env.VITE_ZEROX_API_KEY as string | undefined)?.trim()
  const sellTokenAddr = fromToken?.contractAddress === 'native' ? ZEROX_NATIVE : fromToken != null ? String(fromToken.contractAddress) : null
  const buyTokenAddr = toToken?.contractAddress === 'native' ? ZEROX_NATIVE : toToken != null ? String(toToken.contractAddress) : null

  const buildBridgeTx = async () => {
    if (!session) throw new Error('Unlock card first.')
    if (!fromToken || !toToken) throw new Error('Invalid token selection.')
    if (parsedSellAmount == null || parsedSellAmount <= 0n) throw new Error('Enter a valid amount.')
    const fresh = await fetchLifiQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: fromToken.contractAddress,
      toToken: toToken.contractAddress,
      fromAmount: parsedSellAmount.toString(),
      fromAddress: session.address as `0x${string}`,
      toAddress: session.address as `0x${string}`,
      slippage: (Number.isFinite(settings.slippage) ? settings.slippage : 0.5) / 100,
    })
    setQuote(fresh)
    const req = fresh.transactionRequest
    if (!req?.to || !req?.data) throw new Error('Bridge route unavailable — try another pair.')
    return {
      to: req.to,
      data: req.data as `0x${string}`,
      value: BigInt(req.value ?? 0),
      ...(req.gasLimit ? { gas: BigInt(req.gasLimit) } : {}),
    }
  }

  const ctaLabel = swapError
    ?? (isBridge
      ? quoteLoading
        ? 'Fetching bridge route…'
        : quoteError && bridgeReceive == null
          ? 'Bridge route unavailable'
          : needsApproval
            ? `Approve ${fromToken?.symbol} to continue`
            : 'Review Bridge'
      : 'Review Swap')

  return (
    <div className="ui-screen">
      {/* Main Swap Container */}
      <div className="ui-swap-container">
        {/* YOU PAY CARD */}
        <div className="ui-swap-box">
          <div className="ui-swap-box-header">
            <span className="ui-swap-box-label">
              You pay <span className="font-mono">· {fromChain.badge}</span>
            </span>
            <div className="ui-swap-box-bal">
              <span>
                Bal: {fromToken ? formatAmount(fromToken.balance, fromToken.decimals) : '0.00'}
              </span>
              {fromToken && fromToken.balance > 0n && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="ui-pill-btn"
                    onClick={() => {
                      const half = fromToken.balance / 2n
                      setAmount(formatAmount(half, fromToken.decimals))
                    }}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    className="ui-pill-btn font-semibold"
                    onClick={() => {
                      setAmount(formatAmount(fromToken.balance, fromToken.decimals))
                    }}
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="ui-swap-box-input-row">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="ui-swap-amount-input"
              aria-label="Pay amount"
            />
            <button
              type="button"
              onClick={() => setSelectorTarget('from')}
              className="ui-token-select-btn"
              aria-label="Select token to pay with"
            >
              {fromToken ? (
                <>
                  <TokenIcon symbol={fromToken.symbol} logo={fromToken.logo} size={28} />
                  <span className="ui-token-select-sym">{fromToken.symbol}</span>
                </>
              ) : (
                <span>Select</span>
              )}
              <ChevronDownIcon size={14} className="text-muted-foreground" />
            </button>
          </div>

          <div className="ui-swap-box-footer">
            <span className="text-xs text-muted-foreground">
              {fromUsd != null ? `~$${fromUsd.toFixed(2)} USD` : '— USD'}
            </span>
            {fromToken?.contractAddress === 'native' && (
              <span className="text-[11px] text-muted-foreground">
                Keep a little {fromToken.symbol} for gas fees
              </span>
            )}
          </div>
        </div>

        {/* FLIP BUTTON */}
        <div className="ui-swap-flip-container">
          <button
            type="button"
            onClick={flip}
            className="ui-swap-flip-btn"
            aria-label="Switch swap direction"
            title="Switch direction"
          >
            <SwapArrowsIcon size={18} />
          </button>
        </div>

        {/* YOU RECEIVE CARD */}
        <div className="ui-swap-box">
          <div className="ui-swap-box-header">
            <span className="ui-swap-box-label">
              You receive <span className="font-mono">· {toChain.badge}</span>
            </span>
            <div className="ui-swap-box-bal">
              <span>
                Bal: {toToken ? formatAmount(toToken.balance, toToken.decimals) : '0.00'}
              </span>
            </div>
          </div>

          <div className="ui-swap-box-input-row">
            <div
              className={`ui-swap-amount-input ${estimatedReceive != null ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {isBridge && quoteLoading
                ? '…'
                : estimatedReceive != null
                  ? estimatedReceive < 0.0001
                    ? estimatedReceive.toExponential(2)
                    : estimatedReceive.toFixed(4)
                  : '0.0'}
            </div>
            <button
              type="button"
              onClick={() => setSelectorTarget('to')}
              className="ui-token-select-btn"
              aria-label="Select token to receive"
            >
              {toToken ? (
                <>
                  <TokenIcon symbol={toToken.symbol} logo={toToken.logo} size={28} />
                  <span className="ui-token-select-sym">{toToken.symbol}</span>
                </>
              ) : (
                <span>Select</span>
              )}
              <ChevronDownIcon size={14} className="text-muted-foreground" />
            </button>
          </div>

          <div className="ui-swap-box-footer">
            <span className="text-xs text-muted-foreground">
              {toUsd != null ? `~$${toUsd.toFixed(2)} USD` : '— USD'}
            </span>
            {exchangeRate != null && fromToken && toToken && (
              <button
                type="button"
                onClick={() => setInvertRate(!invertRate)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {!invertRate
                  ? `1 ${fromToken.symbol} ≈ ${exchangeRate.toFixed(4)} ${toToken.symbol}`
                  : `1 ${toToken.symbol} ≈ ${(1 / exchangeRate).toFixed(4)} ${fromToken.symbol}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {isBridge && quoteError && isAmtValid && (
        <Alert variant="destructive">
          <AlertTitle>Bridge quote</AlertTitle>
          <AlertDescription className="text-xs">{quoteError}</AlertDescription>
        </Alert>
      )}

      {/* Quote & Slippage Details Card */}
      <div className="ui-card p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Slippage Tolerance</span>
          <div className="flex items-center gap-1">
            {SLIPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setIsCustomSlip(false)
                  updateSettings({ slippage: s })
                }}
                className={`ui-slip-pill ${!isCustomSlip && settings.slippage === s ? 'active' : ''}`}
              >
                {s}%
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCustomSlip(true)}
              className={`ui-slip-pill ${isCustomSlip ? 'active' : ''}`}
            >
              {isCustomSlip && customSlip ? `${customSlip}%` : 'Custom'}
            </button>
          </div>
        </div>

        {isCustomSlip && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Custom Slippage:</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.5"
              value={customSlip}
              onChange={(e) => {
                setCustomSlip(e.target.value)
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n > 0 && n <= 50) updateSettings({ slippage: n })
              }}
              className="ui-input py-1 px-2 h-7 text-xs w-20"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
          <span className="text-muted-foreground flex items-center gap-1">
            <FuelIcon size={13} />
            <span>Network{isBridge ? 's' : ''}</span>
          </span>
          <div className="flex items-center gap-1.5">
            {isBridge ? (
              <Badge variant="outline" className="text-[11px] py-0 font-medium">
                {fromChain.badge} {fromChain.chain.name} → {toChain.badge} {toChain.chain.name}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] py-0 font-medium">
                {fromChain.badge} {fromChain.chain.name}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Route</span>
          <span className="text-muted-foreground text-[11px]">
            {isBridge
              ? (routeLabel ? `LI.FI · ${routeLabel}` : quoteLoading ? 'Finding route…' : 'LI.FI bridge aggregator')
              : zeroXKey
                ? '0x Protocol v2'
                : 'Best DEX Route (Estimated)'}
          </span>
        </div>

        {isBridge && (etaLabel || feeUsd != null) && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Bridge ETA / fees</span>
            <span className="text-[11px] font-medium">
              {[etaLabel, feeUsd != null ? `~$${feeUsd.toFixed(2)}` : null].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </div>

      {done && (
        <Alert>
          <AlertTitle>{isBridge ? 'Bridge submitted ✓' : 'Swap submitted ✓'}</AlertTitle>
          <AlertDescription className="ui-mono text-xs break-all">{done}</AlertDescription>
          {isBridge && (
            <a
              href={lifiScanUrl(done)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary font-semibold hover:underline"
            >
              Track bridge status →
            </a>
          )}
        </Alert>
      )}

      {/* Main Review / Action CTA */}
      <div className="pt-1 space-y-2">
        {isBridge && needsApproval && approvalAddr && fromToken && canReview && (
          <Button size="lg" block variant="outline" onClick={() => setApproveOpen(true)}>
            1. Approve {fromToken.symbol}
          </Button>
        )}
        <Button
          size="lg"
          block
          disabled={reviewDisabled}
          onClick={() => {
            if (isBridge && needsApproval) setApproveOpen(true)
            else setConfirm(true)
          }}
          className="ui-btn-glow"
        >
          {ctaLabel}
        </Button>
      </div>

      {/* Token Selection Bottom Sheet */}
      <TokenSelectSheet
        open={selectorTarget !== null}
        onClose={() => setSelectorTarget(null)}
        title={selectorTarget === 'from' ? 'Pay with' : 'Receive'}
        activeChainId={selectorTarget === 'to' ? toChainId : fromChainId}
        onChainChange={(id) => {
          if (selectorTarget === 'to') handleToChain(id)
          else handleFromChain(id)
        }}
        tokens={sheetTokens}
        selectedToken={selectorTarget === 'from' ? fromToken : toToken}
        onSelect={(t) => {
          if (selectorTarget === 'from') {
            setFromToken(t)
            setFromChainId(t.chainId)
            // Same network + same token = invalid pair → pick an alternative.
            if (
              toToken &&
              toToken.chainId === t.chainId &&
              String(t.contractAddress).toLowerCase() === String(toToken.contractAddress).toLowerCase()
            ) {
              const alt =
                toList.find(
                  (x) => String(x.contractAddress).toLowerCase() !== String(t.contractAddress).toLowerCase(),
                ) ?? null
              setToToken(alt)
            }
            setAmount('')
            setQuote(null)
            setNeedsApproval(false)
          } else {
            setToToken(t)
            setToChainId(t.chainId)
            if (
              fromToken &&
              fromToken.chainId === t.chainId &&
              String(t.contractAddress).toLowerCase() === String(fromToken.contractAddress).toLowerCase()
            ) {
              const alt =
                fromList.find(
                  (x) => String(x.contractAddress).toLowerCase() !== String(t.contractAddress).toLowerCase(),
                ) ?? null
              setFromToken(alt)
            }
            setQuote(null)
            setNeedsApproval(false)
          }
        }}
      />

      {/* ERC-20 approval sheet (bridge only) */}
      {fromToken && approvalAddr && (
        <TapToSign
          open={approveOpen}
          title={`Approve ${fromToken.symbol}`}
          chainId={fromChainId}
          lines={[
            { k: 'Spender', v: approvalAddr },
            { k: 'Token', v: String(fromToken.contractAddress) },
            { k: 'Amount', v: 'Unlimited' },
            { k: 'Network', v: fromChain.chain.name },
          ]}
          buildTx={async () => {
            if (!session) throw new Error('Unlock card first.')
            if (fromToken.contractAddress === 'native') throw new Error('Native token needs no approval.')
            return {
              to: fromToken.contractAddress as `0x${string}`,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [approvalAddr, MAX_UINT],
              }),
              value: 0n,
            }
          }}
          onDone={() => {
            setNeedsApproval(false)
            setApproveOpen(false)
            setConfirm(true)
          }}
          onClose={() => setApproveOpen(false)}
        />
      )}

      {/* Tap to Sign confirmation sheet */}
      {fromToken && toToken && (
        <TapToSign
          open={confirm}
          title={isBridge ? 'Confirm Bridge' : 'Confirm Swap'}
          chainId={fromChainId}
          lines={[
            { k: 'Pay', v: `${amount.trim()} ${fromToken.symbol} (${fromChain.chain.name})` },
            {
              k: 'Receive',
              v:
                estimatedReceive != null
                  ? `~${estimatedReceive.toFixed(4)} ${toToken.symbol} (${toChain.chain.name})`
                  : `~ ${toToken.symbol} (${toChain.chain.name})`,
            },
            ...(isBridge && routeLabel ? [{ k: 'Route', v: routeLabel }] : []),
            ...(isBridge && etaLabel ? [{ k: 'ETA', v: etaLabel }] : []),
            ...(!isBridge ? [{ k: 'Network', v: fromChain.chain.name }] : []),
            { k: 'Max Slippage', v: `${settings.slippage}%` },
          ]}
          buildTx={async () => {
            if (isBridge) return buildBridgeTx()
            if (!session) throw new Error('Unlock card first.')
            if (!sellTokenAddr || !buyTokenAddr) throw new Error('Invalid token selection.')
            if (parsedSellAmount == null || parsedSellAmount <= 0n)
              throw new Error('Enter a valid amount.')

            const sellAmount = parsedSellAmount.toString()
            const slip =
              Number.isFinite(settings.slippage) &&
              settings.slippage > 0 &&
              settings.slippage <= 50
                ? settings.slippage
                : 0.5

            if (!zeroXKey) {
              return {
                to: session.address,
                data: '0x' as `0x${string}`,
                value: fromToken.contractAddress === 'native' ? parsedSellAmount : 0n,
              }
            }

            const q = new URLSearchParams({
              chainId: String(fromToken.chainId),
              sellToken: sellTokenAddr,
              buyToken: buyTokenAddr,
              sellAmount,
              taker: session.address,
              slippagePercentage: String(slip / 100),
            })
            const res = await fetch(`https://api.0x.org/swap/v1/quote?${q}`, {
              headers: { '0x-api-key': zeroXKey },
            })
            if (!res.ok) {
              let detail = ''
              try {
                const body = await res.text()
                if (body) detail = ` — ${body.slice(0, 200)}`
              } catch {
                /* ignore */
              }
              throw new Error(`0x quote error ${res.status}${detail}`)
            }
            const quoteRes = (await res.json()) as { to: string; data: string; value?: string }
            return {
              to: quoteRes.to as `0x${string}`,
              data: quoteRes.data as `0x${string}`,
              value: BigInt(quoteRes.value ?? 0),
            }
          }}
          onDone={(h) => {
            setDone(h)
            setConfirm(false)
            setAmount('')
            setQuote(null)
            quoteKeyRef.current = null
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
