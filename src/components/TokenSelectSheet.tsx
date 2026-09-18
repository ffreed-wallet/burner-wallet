import { useEffect, useMemo, useState } from 'react'
import { allChains } from '../lib/chains'
import { formatAmount } from '../lib/sync'
import { TokenIcon } from './TokenIcon'
import { useDismissSheets } from './useDismissSheets'
import { Badge } from './ui/badge'
import { CloseIcon, SearchIcon, CheckIcon } from './ui/icons'

export interface SelectableToken {
  chainId: number
  contractAddress: `0x${string}` | 'native'
  symbol: string
  name: string
  decimals: number
  balance: bigint
  priceUsd?: number
  logo?: string
  isOwned?: boolean
}

export interface TokenSelectSheetProps {
  open: boolean
  onClose: () => void
  tokens: SelectableToken[]
  selectedToken: SelectableToken | null
  onSelect: (token: SelectableToken) => void
  title?: string
  activeChainId?: number
  onChainChange?: (chainId: number) => void
}

/**
 * Universal Token Selection Sheet (Rainbow / Rabby standard):
 * - Clean search filtering by name, symbol, address
 * - Quick filter chips for top major tokens (ETH, USDC, USDT, WBTC, DAI)
 * - Clear separation of user-owned balances vs discoverable ecosystem tokens
 */
export function TokenSelectSheet({
  open,
  onClose,
  tokens,
  selectedToken,
  onSelect,
  title = 'Select a token',
  activeChainId,
  onChainChange,
}: TokenSelectSheetProps) {
  const [search, setSearch] = useState('')
  const [internalChain, setInternalChain] = useState<number | 'all'>('all')
  useDismissSheets(onClose)

  const currentChain = activeChainId ?? internalChain

  const handleChainSelect = (chainId: number | 'all') => {
    if (onChainChange && chainId !== 'all') {
      onChainChange(chainId)
    }
    setInternalChain(chainId)
  }

  useEffect(() => {
    if (activeChainId != null) {
      setInternalChain(activeChainId)
    }
  }, [activeChainId])

  const chains = useMemo(() => allChains(true), [])
  const chainMap = useMemo(() => new Map(chains.map((c) => [c.chain.id, c] as const)), [chains])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tokens.filter((t) => {
      if (currentChain !== 'all' && t.chainId !== currentChain) return false
      if (!q) return true
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.contractAddress !== 'native' && t.contractAddress.toLowerCase().includes(q))
      )
    })
  }, [tokens, search, currentChain])

  const ownedTokens = useMemo(() => filtered.filter((t) => (t.balance ?? 0n) > 0n), [filtered])
  const unownedTokens = useMemo(() => filtered.filter((t) => (t.balance ?? 0n) === 0n), [filtered])

  if (!open) return null

  const handleSelect = (t: SelectableToken) => {
    onSelect(t)
    onClose()
  }

  return (
    <div className="ui-sheet-overlay" onClick={onClose}>
      <div
        className="ui-sheet-content ui-token-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="ui-sheet-grabber">
          <span />
        </div>

        {/* Modal Header */}
        <div className="ui-modal-header">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* Search Input */}
          <div className="ui-search-bar">
            <SearchIcon size={16} className="ui-search-icon" />
            <input
              type="text"
              placeholder="Search by name, symbol, or address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ui-search-input"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>

          {/* Quick select chips for common tokens */}
          <div className="ui-quick-chips">
            {['ETH', 'USDC', 'USDT', 'WBTC', 'DAI'].map((sym) => {
              const match = tokens.find((t) => t.symbol.toUpperCase() === sym)
              if (!match) return null
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => handleSelect(match)}
                  className="ui-quick-chip"
                >
                  <TokenIcon symbol={sym} logo={match.logo} size={16} />
                  <span>{sym}</span>
                </button>
              )
            })}
          </div>

          {/* Chain filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
            <button
              type="button"
              onClick={() => handleChainSelect('all')}
              className={`ui-chain-chip ${currentChain === 'all' ? 'active' : ''}`}
            >
              All Networks
            </button>
            {chains.map((c) => (
              <button
                key={c.chain.id}
                type="button"
                onClick={() => handleChainSelect(c.chain.id)}
                className={`ui-chain-chip ${currentChain === c.chain.id ? 'active' : ''}`}
              >
                <span>{c.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Token List */}
        <div className="ui-token-list">
          {/* Owned Tokens */}
          {ownedTokens.length > 0 && (
            <div className="space-y-1">
              <div className="ui-token-section-title">Your tokens</div>
              {ownedTokens.map((t) => {
                const isSelected =
                  selectedToken?.symbol === t.symbol && selectedToken?.chainId === t.chainId
                const chainEntry = chainMap.get(t.chainId)

                return (
                  <button
                    key={`owned-${t.chainId}-${t.contractAddress}-${t.symbol}`}
                    type="button"
                    onClick={() => handleSelect(t)}
                    className={`ui-token-row ${isSelected ? 'selected' : ''}`}
                  >
                    <TokenIcon
                      symbol={t.symbol}
                      logo={t.logo}
                      chainBadge={chainEntry?.badge}
                      size={36}
                    />
                    <div className="ui-token-row-info">
                      <div className="ui-token-row-symbol">
                        <span>{t.symbol}</span>
                        {chainEntry && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {chainEntry.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="ui-token-row-name">{t.name}</div>
                    </div>
                    <div className="ui-token-row-balance">
                      <div className="ui-token-row-amount">
                        {formatAmount(t.balance, t.decimals)}
                      </div>
                      {t.priceUsd != null && (
                        <div className="ui-token-row-usd">
                          $
                          {(
                            (Number(t.balance) / 10 ** t.decimals) *
                            t.priceUsd
                          ).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="ui-token-row-check">
                        <CheckIcon size={16} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Popular / Available Tokens */}
          {unownedTokens.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="ui-token-section-title">
                {ownedTokens.length > 0 ? 'Popular tokens' : 'Available tokens'}
              </div>
              {unownedTokens.map((t) => {
                const isSelected =
                  selectedToken?.symbol === t.symbol && selectedToken?.chainId === t.chainId
                const chainEntry = chainMap.get(t.chainId)

                return (
                  <button
                    key={`avail-${t.chainId}-${t.contractAddress}-${t.symbol}`}
                    type="button"
                    onClick={() => handleSelect(t)}
                    className={`ui-token-row ${isSelected ? 'selected' : ''}`}
                  >
                    <TokenIcon
                      symbol={t.symbol}
                      logo={t.logo}
                      chainBadge={chainEntry?.badge}
                      size={36}
                    />
                    <div className="ui-token-row-info">
                      <div className="ui-token-row-symbol">
                        <span>{t.symbol}</span>
                        {chainEntry && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {chainEntry.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="ui-token-row-name">{t.name}</div>
                    </div>
                    {t.priceUsd != null && (
                      <div className="ui-token-row-balance">
                        <div className="ui-token-row-usd font-mono">${t.priceUsd.toFixed(2)}</div>
                      </div>
                    )}
                    {isSelected && (
                      <div className="ui-token-row-check">
                        <CheckIcon size={16} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="ui-token-empty text-center py-8">
              <p className="text-sm font-semibold">No tokens found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for a different symbol or address.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
