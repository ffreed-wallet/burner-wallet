import { useMemo, useState } from 'react'
import { shortAddress } from '../lib/burner'
import { allChains, explorerTxUrl } from '../lib/chains'
import type { ActivityItem } from '../lib/portfolio'
import { useWallet } from '../store'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  ActivityIcon,
  ExternalLinkIcon,
  SendIcon,
  ReceiveIcon,
  SwapArrowsIcon,
} from '../components/ui/icons'

function formatTimeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/**
 * Modern Activity screen:
 * Unified list with directional icons, clear amounts, time stamps,
 * and quick explorer links (Rainbow / Rabby standard).
 */
export function Activity() {
  const { activity, session, settings } = useWallet()
  const [filterChain, setFilterChain] = useState<number | 'all'>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'sent' | 'received'>('all')
  const [selectedTx, setSelectedTx] = useState<ActivityItem | null>(null)

  const chains = useMemo(() => allChains(settings.showTestnets), [settings.showTestnets])
  const chainMap = useMemo(() => new Map(chains.map((c) => [c.chain.id, c] as const)), [chains])

  // Filtered transactions
  const txList = useMemo(() => {
    return activity.filter((a) => {
      if (filterChain !== 'all' && a.chainId !== filterChain) return false
      const isSent =
        session?.address && a.from.toLowerCase() === session.address.toLowerCase()
      if (activeFilter === 'sent' && !isSent) return false
      if (activeFilter === 'received' && isSent) return false
      return true
    })
  }, [activity, filterChain, activeFilter, session])

  return (
    <div className="ui-screen space-y-3">
      {/* Screen Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-base font-bold tracking-tight">Activity</h1>
          <p className="text-xs text-muted-foreground">
            {activity.length} transaction{activity.length === 1 ? '' : 's'} recorded
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2 py-1 rounded-md transition-colors ${activeFilter === 'all' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('received')}
            className={`px-2 py-1 rounded-md transition-colors ${activeFilter === 'received' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground'}`}
          >
            Received
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('sent')}
            className={`px-2 py-1 rounded-md transition-colors ${activeFilter === 'sent' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground'}`}
          >
            Sent
          </button>
        </div>
      </div>

      {/* Network Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
        <button
          type="button"
          onClick={() => setFilterChain('all')}
          className={`ui-chain-chip ${filterChain === 'all' ? 'active' : ''}`}
        >
          All Networks
        </button>
        {chains.map((c) => (
          <button
            key={c.chain.id}
            type="button"
            onClick={() => setFilterChain(c.chain.id)}
            className={`ui-chain-chip ${filterChain === c.chain.id ? 'active' : ''}`}
          >
            <span>{c.badge}</span>
            <span className="hidden sm:inline">{c.chain.name}</span>
          </button>
        ))}
      </div>

      {/* Transactions List Container */}
      <div className="ui-card overflow-hidden">
        {txList.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <ActivityIcon size={24} />
            </div>
            <h3 className="text-sm font-semibold">No activity found</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Transactions made from or to this card will appear here once confirmed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {txList.map((tx, idx) => {
              const isSent =
                session?.address && tx.from.toLowerCase() === session.address.toLowerCase()
              const chainEntry = chainMap.get(tx.chainId)
              const explorerUrl = explorerTxUrl(tx.chainId, tx.hash)

              return (
                <div
                  key={`${tx.chainId}-${tx.hash}-${idx}`}
                  onClick={() => setSelectedTx(tx)}
                  className="ui-activity-row group cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  {/* Icon */}
                  <div
                    className={`ui-activity-icon ${
                      isSent ? 'sent' : tx.category === 'swap' ? 'swap' : 'received'
                    }`}
                  >
                    {isSent ? (
                      <SendIcon size={16} />
                    ) : tx.category === 'swap' ? (
                      <SwapArrowsIcon size={16} />
                    ) : (
                      <ReceiveIcon size={16} />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      <span>{isSent ? 'Sent' : 'Received'}</span>
                      <span className="text-foreground">{tx.asset || 'ETH'}</span>
                      {chainEntry && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                          {chainEntry.badge}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <span>{isSent ? `To: ${shortAddress(tx.to)}` : `From: ${shortAddress(tx.from)}`}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(tx.timestamp)}</span>
                    </div>
                  </div>

                  {/* Value & Status */}
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold font-mono ${
                        isSent ? 'text-foreground' : 'text-emerald-500'
                      }`}
                    >
                      {isSent ? '-' : '+'}
                      {tx.value} {tx.asset}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span
                        className={`text-[10px] font-medium capitalize ${
                          tx.status === 'confirmed'
                            ? 'text-muted-foreground'
                            : tx.status === 'failed'
                              ? 'text-red-500'
                              : 'text-amber-500'
                        }`}
                      >
                        {tx.status}
                      </span>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="View in Explorer"
                        >
                          <ExternalLinkIcon size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Transaction Detail Sheet */}
      {selectedTx && (
        <div className="ui-sheet-overlay" onClick={() => setSelectedTx(null)}>
          <div
            className="ui-sheet-content space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="ui-sheet-grabber">
              <span />
            </div>

            <div className="text-center pt-2">
              <div
                className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                  session?.address && selectedTx.from.toLowerCase() === session.address.toLowerCase()
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}
              >
                {session?.address && selectedTx.from.toLowerCase() === session.address.toLowerCase() ? (
                  <SendIcon size={22} />
                ) : (
                  <ReceiveIcon size={22} />
                )}
              </div>
              <h2 className="text-lg font-bold">
                {session?.address && selectedTx.from.toLowerCase() === session.address.toLowerCase()
                  ? 'Sent'
                  : 'Received'}{' '}
                {selectedTx.value} {selectedTx.asset}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTimeAgo(selectedTx.timestamp)}
              </p>
            </div>

            <div className="ui-card p-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={selectedTx.status === 'confirmed' ? 'success' : 'outline'}>
                  {selectedTx.status}
                </Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Network</span>
                <span>{chainMap.get(selectedTx.chainId)?.chain.name ?? `#${selectedTx.chainId}`}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">From</span>
                <span className="font-mono text-foreground break-all">{selectedTx.from}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-foreground break-all">{selectedTx.to}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Hash</span>
                <span className="font-mono text-muted-foreground truncate max-w-[180px]">
                  {selectedTx.hash}
                </span>
              </div>
            </div>

            {explorerTxUrl(selectedTx.chainId, selectedTx.hash) && (
              <Button variant="outline" block asChild>
                <a
                  href={explorerTxUrl(selectedTx.chainId, selectedTx.hash)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5"
                >
                  <span>View on Block Explorer</span>
                  <ExternalLinkIcon size={14} />
                </a>
              </Button>
            )}

            <Button variant="ghost" block onClick={() => setSelectedTx(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
