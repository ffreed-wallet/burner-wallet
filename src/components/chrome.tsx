import { useState } from 'react'
import { shortAddress } from '../lib/burner'
import { useEnsProfile } from '../lib/ens'
import { applyTheme, useWallet, type Tab } from '../store'
import {
  WalletIcon,
  NftIcon,
  SwapArrowsIcon,
  ActivityIcon,
  ConnectIcon,
  SettingsIcon,
  ScanIcon,
  CheckIcon,
  CopyIcon,
  SunIcon,
  MoonIcon,
} from './ui/icons'

export function AppBar({ onScan }: { onScan?: () => void }) {
  const { session, settings, updateSettings, accountName } = useWallet()
  const ens = useEnsProfile(session?.address)
  const [copied, setCopied] = useState(false)

  const displayName = accountName || (ens.name ? ens.name : session ? shortAddress(session.address) : 'Locked')

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

  const toggleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark'
    updateSettings({ theme: next })
    applyTheme(next)
  }

  return (
    <header className="ui-appbar">
      {/* Wallet Identity Pill */}
      {session ? (
        <button
          type="button"
          onClick={copyAddress}
          className="ui-appbar-pill"
          title="Click to copy address"
          aria-label="Copy wallet address"
        >
          <div className="ui-avatar-indicator bg-primary">
            {ens.avatar ? (
              <img src={ens.avatar} alt="" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <span className="ui-appbar-name">{displayName}</span>
          <span className="ui-appbar-copy">
            {copied ? (
              <CheckIcon size={13} className="text-emerald-500" />
            ) : (
              <CopyIcon size={13} />
            )}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 px-1">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-muted-foreground">Burner Offline</span>
        </div>
      )}

      {/* Action shortcuts: Scan card & Theme toggle */}
      <div className="ui-appbar-actions">
        {onScan && (
          <button
            type="button"
            onClick={onScan}
            className="ui-btn-icon-soft"
            title="Scan Burner Card"
            aria-label="Scan Burner Card"
          >
            <ScanIcon size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="ui-btn-icon-soft"
          title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {settings.theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
        </button>
      </div>
    </header>
  )
}

interface NavItem {
  id: Tab
  label: string
  icon: (active: boolean) => React.ReactNode
  badge?: number
}

export function TabBar() {
  const { tab, setTab, pendingTxs, dismissSheets } = useWallet()

  const tabs: NavItem[] = [
    {
      id: 'home',
      label: 'Wallet',
      icon: () => <WalletIcon size={20} />,
    },
    {
      id: 'nfts',
      label: 'NFTs',
      icon: () => <NftIcon size={20} />,
    },
    {
      id: 'swap',
      label: 'Swap',
      icon: () => <SwapArrowsIcon size={20} />,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: () => <ActivityIcon size={20} />,
      badge: pendingTxs.length > 0 ? pendingTxs.length : undefined,
    },
    {
      id: 'connect',
      label: 'Apps',
      icon: () => <ConnectIcon size={20} />,
    },
    {
      id: 'more',
      label: 'Settings',
      icon: () => <SettingsIcon size={20} />,
    },
  ]

  return (
    <nav className="ui-tabbar" aria-label="Main Navigation">
      {tabs.map((t) => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            type="button"
            data-active={active}
            onClick={() => {
              setTab(t.id)
              dismissSheets()
            }}
            className="ui-tabbar-item"
            aria-selected={active}
            aria-label={t.label}
          >
            <div className="ui-tabbar-icon-wrap">
              <div className="ui-tabbar-icon">{t.icon(active)}</div>
              {t.badge != null && <span className="ui-tabbar-badge">{t.badge}</span>}
            </div>
            <span className="ui-tabbar-label">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
