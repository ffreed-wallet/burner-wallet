import { useMemo, useState } from 'react'
import { TokenIcon } from '../components/TokenIcon'
import { shortAddress } from '../lib/burner'
import { allChains } from '../lib/chains'
import { useEnsProfile } from '../lib/ens'
import { formatAmount, tokenValueUsd } from '../lib/sync'
import { useWallet } from '../store'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  SendIcon,
  ReceiveIcon,
  SwapArrowsIcon,
  RefreshIcon,
  SearchIcon,
  CloseIcon,
  CheckIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '../components/ui/icons'

function chainMaps() {
  const list = allChains(true)
  return {
    name: new Map(list.map((c) => [c.chain.id, c.chain.name] as const)),
    badge: new Map(list.map((c) => [c.chain.id, c.badge] as const)),
  }
}

function chainName(chainId: number, m?: ReturnType<typeof chainMaps>): string {
  if (m) return m.name.get(chainId) ?? `#${chainId}`
  return allChains(true).find((c) => c.chain.id === chainId)?.chain.name ?? `#${chainId}`
}

function chainBadge(chainId: number, m?: ReturnType<typeof chainMaps>): string {
  if (m) return m.badge.get(chainId) ?? `#${chainId}`
  return allChains(true).find((c) => c.chain.id === chainId)?.badge ?? `#${chainId}`
}

function pad4(s: string): string {
  const i = s.indexOf('.')
  if (i === -1) return `${s}.0000`
  const frac = s.length - i - 1
  return frac >= 4 ? s : `${s}${'0'.repeat(4 - frac)}`
}

function groupAmount(items: { balance: bigint; decimals: number }[]): string {
  if (items.length === 0) return pad4('0')
  const decimals = new Set(items.map((t) => t.decimals))
  if (decimals.size === 1) {
    const d = items[0].decimals
    const sum = items.reduce((a, t) => a + t.balance, 0n)
    return pad4(formatAmount(sum, d))
  }
  const sum = items.reduce((a, t) => a + Number(t.balance) / 10 ** t.decimals, 0)
  const s = sum.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return pad4(s)
}

/**
 * Home: Rainbow / Rabby style presentation:
 * - Prominent balance hero card with quick copy and sync
 * - 3 Action buttons: Send, Receive, Swap
 * - Unified token list with search, clean per-chain breakdown, and zero clutter.
 */
export function Home({
  onSync,
  onSend,
  onReceive,
}: {
  onSync: () => void
  onSend: () => void
  onReceive: () => void
}) {
  const {
    tokens,
    syncing,
    settings,
    updateSettings,
    session,
    hiddenTokens,
    hideToken,
    clearHiddenTokens,
    accountName,
    setTab,
  } = useWallet()

  const ens = useEnsProfile(session?.address)
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const masked = settings.hideBalances
  const chainMap = useMemo(() => chainMaps(), [])

  const { groups, all, dustHidden } = useMemo(() => {
    const map = new Map<
      string,
      { symbol: string; logo?: string; price?: number; items: typeof tokens; total: number | null }
    >()
    for (const t of tokens) {
      const key = t.symbol.toUpperCase()
      const g = map.get(key) ?? {
        symbol: t.symbol.toUpperCase(),
        logo: t.logo,
        price: t.priceUsd,
        items: [],
        total: 0,
      }
      g.items.push(t)
      if (!g.logo && t.logo) g.logo = t.logo
      if (t.priceUsd != null) g.price = t.priceUsd
      map.set(key, g)
    }
    for (const g of map.values()) {
      let sum: number | null = 0
      for (const t of g.items) {
        const v = tokenValueUsd(t.balance, t.decimals, t.priceUsd)
        if (v == null) {
          sum = null
          break
        }
        sum += v
      }
      g.total = sum
    }
    const all = [...map.values()].sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
    const q = query.trim().toUpperCase()
    const shown = all.filter((g) => {
      if (hiddenTokens.includes(g.symbol)) return false
      if (settings.hideSmall && (g.total ?? 1) < 1) return false
      return !q || g.symbol.includes(q)
    })
    const dustHidden = settings.hideSmall
      ? all.filter((g) => !hiddenTokens.includes(g.symbol) && (g.total ?? 1) < 1).length
      : 0
    return { groups: shown, all, dustHidden }
  }, [tokens, query, settings.hideSmall, hiddenTokens])

  const { grand, unpriced } = useMemo(() => {
    let sum = 0
    let unknown = 0
    let any = false
    for (const g of all) {
      if (hiddenTokens.includes(g.symbol)) continue
      if (g.total == null) {
        unknown += 1
        continue
      }
      sum += g.total
      any = true
    }
    return { grand: any ? sum : null, unpriced: unknown }
  }, [all, hiddenTokens])

  const userLabel = accountName || (ens.name ? ens.name : 'Burner Card')

  const copyAddress = async () => {
    if (!session?.address) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(session.address)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="ui-screen space-y-4">
      {/* Hero Balance Card (Rainbow style) */}
      <div className="ui-hero-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-primary text-primary-foreground font-bold text-sm shadow-sm shadow-primary/20">
              {ens.avatar ? (
                <img src={ens.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                userLabel.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{userLabel}</span>
                {ens.name && <Badge variant="success" className="text-[10px] py-0 px-1">ENS</Badge>}
              </div>
              <button
                type="button"
                onClick={copyAddress}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono cursor-pointer"
                title="Copy full address"
              >
                <span>{session ? shortAddress(session.address) : 'No card detected'}</span>
                {copied ? (
                  <CheckIcon size={12} className="text-emerald-500" />
                ) : (
                  <CopyIcon size={12} />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateSettings({ hideBalances: !settings.hideBalances })}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              title={masked ? 'Show balance' : 'Hide balance'}
              aria-label={masked ? 'Show balance' : 'Hide balance'}
            >
              <span className="text-xs font-bold">{masked ? '••••' : '$'}</span>
            </button>
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className={`p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors ${
                syncing ? 'animate-spin' : ''
              }`}
              title="Refresh balances"
              aria-label="Refresh balances"
            >
              <RefreshIcon size={16} />
            </button>
          </div>
        </div>

        {/* Big Balance Display */}
        <div className="my-5">
          <div className="text-xs font-medium text-muted-foreground mb-1">Total Balance</div>
          <div className="text-[34px] leading-none font-extrabold tracking-tight tabular-nums">
            {masked ? (
              '••••••••'
            ) : grand == null ? (
              '—'
            ) : (
              `$${grand.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unpriced > 0 ? '+' : ''}`
            )}
          </div>
          {!masked && unpriced > 0 && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              + {unpriced} token{unpriced === 1 ? '' : 's'} unpriced
            </div>
          )}
        </div>

        {/* 3 Action Buttons: Send, Receive, Swap */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onSend}
            className="ui-action-btn"
            aria-label="Send crypto"
          >
            <div className="ui-action-icon-wrap bg-primary/15 text-primary">
              <SendIcon size={18} />
            </div>
            <span className="ui-action-label">Send</span>
          </button>

          <button
            type="button"
            onClick={onReceive}
            className="ui-action-btn"
            aria-label="Receive crypto"
          >
            <div className="ui-action-icon-wrap bg-emerald-500/15 text-emerald-500">
              <ReceiveIcon size={18} />
            </div>
            <span className="ui-action-label">Receive</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('swap')}
            className="ui-action-btn"
            aria-label="Swap crypto"
          >
            <div className="ui-action-icon-wrap bg-indigo-500/15 text-indigo-500">
              <SwapArrowsIcon size={18} />
            </div>
            <span className="ui-action-label">Swap</span>
          </button>
        </div>
      </div>

      {/* Token List Section */}
      <div className="ui-card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <div className="ui-search-bar flex-1">
            <SearchIcon size={16} className="ui-search-icon" />
            <input
              type="text"
              placeholder="Search tokens…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ui-search-input text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>
          <Badge variant="secondary" className="text-[11px] font-medium py-1 px-2 shrink-0">
            {groups.length} {groups.length === 1 ? 'asset' : 'assets'}
          </Badge>
        </div>

        {/* Empty states */}
        {groups.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold">
              {query ? `No matches for "${query}"` : 'No tokens to show'}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {query
                ? 'Try a different symbol or clear your search query.'
                : settings.hideSmall && dustHidden > 0
                  ? `You have ${dustHidden} token(s) under $1 hidden.`
                  : 'Fund your card with crypto to see your assets appear here.'}
            </p>
            {query && (
              <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                Clear Search
              </Button>
            )}
            {!query && settings.hideSmall && dustHidden > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSettings({ hideSmall: false })}
              >
                Show small balances ({dustHidden})
              </Button>
            )}
          </div>
        )}

        {/* Asset Rows */}
        <div className="divide-y divide-border">
          {groups.map((g) => {
            const chains = [...new Set(g.items.map((t) => chainName(t.chainId, chainMap)))].join(
              ', ',
            )
            const expanded = open === g.symbol
            const topItem = g.items[0]
            const chainEntry = topItem ? allChains(true).find((c) => c.chain.id === topItem.chainId) : undefined

            return (
              <div key={g.symbol} className="ui-token-group">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : g.symbol)}
                  className="ui-home-token-row group"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${g.symbol} balances`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TokenIcon
                      symbol={g.symbol}
                      logo={g.logo}
                      chainBadge={g.items.length === 1 ? chainEntry?.badge : undefined}
                      size={40}
                    />
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-sm">
                        <span>{g.symbol}</span>
                        {g.items.length > 1 && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {g.items.length} chains
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {chains}
                        {!masked && g.price != null && ` · $${g.price.toFixed(2)}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">
                      {masked ? '••••' : g.total == null ? '—' : `$${g.total.toFixed(2)}`}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-1 font-mono">
                      <span>{masked ? '••••' : groupAmount(g.items)}</span>
                      <span className="text-muted-foreground/60 transition-transform group-hover:translate-y-0.5">
                        {expanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded multi-chain details */}
                {expanded && (
                  <div className="ui-home-token-expanded">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Holdings by network
                    </div>
                    <div className="space-y-1.5">
                      {g.items.map((t, i) => {
                        const val = tokenValueUsd(t.balance, t.decimals, t.priceUsd)
                        const cBadge = chainBadge(t.chainId, chainMap)
                        const cName = chainName(t.chainId, chainMap)
                        return (
                          <div
                            key={`${t.chainId}-${String(t.contractAddress)}-${i}`}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-semibold">
                                {cBadge}
                              </Badge>
                              <span className="font-medium">{cName}</span>
                            </div>
                            <div className="text-right font-mono">
                              <div className="font-semibold">
                                {masked ? '••••' : pad4(formatAmount(t.balance, t.decimals))} {t.symbol}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {masked ? '••••' : val == null ? '—' : `$${val.toFixed(2)}`}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between items-center pt-2 px-1">
                      <button
                        type="button"
                        onClick={() => hideToken(g.symbol)}
                        className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        Hide from wallet
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('swap')}
                        className="text-[11px] text-primary font-semibold hover:underline"
                      >
                        Swap {g.symbol} →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Restore hidden tokens banner if any */}
        {hiddenTokens.length > 0 && (
          <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {hiddenTokens.length} token{hiddenTokens.length === 1 ? '' : 's'} hidden
            </span>
            <Button variant="link" size="sm" onClick={clearHiddenTokens} className="h-auto p-0 text-xs">
              Restore all
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
