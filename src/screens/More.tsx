import { useState, type ReactNode } from 'react'
import {
  clearCardAccount,
  clearCardPassword,
  clearSavedAddress,
  shortAddress,
} from '../lib/burner'
import {
  allChains,
  loadCustomChains,
  saveCustomChains,
  type CustomChain,
} from '../lib/chains'
import { FAUCETS } from '../lib/faucets'
import { applyTheme, useWallet, type Theme } from '../store'
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
} from '../components/ui/icons'

/* -------------------------------------------------------------------------- */
/* Group Container Component (Emil Kowalski style grouped list)                */
/* -------------------------------------------------------------------------- */

function SettingsGroup({
  title,
  children,
  action,
}: {
  title?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {title && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {title}
          </span>
          {action}
        </div>
      )}
      <div className="ui-card overflow-hidden divide-y divide-border/60">
        {children}
      </div>
    </div>
  )
}

function SettingsRow({
  label,
  sublabel,
  children,
  icon,
  onClick,
}: {
  label: string
  sublabel?: string
  children?: ReactNode
  icon?: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-3.5 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-muted/40 active:bg-muted/60' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {icon && (
          <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center shrink-0 text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug truncate">{label}</div>
          {sublabel && (
            <div className="text-xs text-muted-foreground leading-snug mt-0.5 truncate">
              {sublabel}
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">{children}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Main Settings Screen                                                       */
/* -------------------------------------------------------------------------- */

export function More({ onSync }: { onSync: () => void }) {
  const {
    session,
    setSession,
    accountName,
    setAccountName,
    settings,
    updateSettings,
  } = useWallet()

  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(accountName)

  // Network State
  const [customs, setCustoms] = useState<CustomChain[]>(() => loadCustomChains())
  const [customModal, setCustomModal] = useState(false)
  const [form, setForm] = useState({
    id: '',
    name: '',
    rpcUrl: '',
    explorer: '',
    nativeSymbol: 'ETH',
  })

  const copyAddress = async () => {
    if (!session) return
    try {
      await navigator.clipboard?.writeText(session.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  const handleLock = () => {
    clearCardAccount()
    clearSavedAddress()
    clearCardPassword()
    setSession(null)
  }

  const handleClearCache = () => {
    if (
      !confirm(
        'Erase cached card data, network history, and preferences? Your burner card private keys stay secure on the card chip.',
      )
    ) {
      return
    }
    try {
      const doomed: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('burner.')) doomed.push(k)
      }
      for (const k of doomed) localStorage.removeItem(k)
      sessionStorage.clear()
    } catch {
      /* noop */
    }
    try {
      clearCardPassword()
    } catch {
      /* noop */
    }
    const hasCaches = typeof window !== 'undefined' && 'caches' in window
    if (hasCaches) {
      void caches
        .keys()
        .then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
        .finally(() => window.location.reload())
    } else {
      window.location.reload()
    }
  }

  const setTheme = (t: Theme) => {
    updateSettings({ theme: t })
    applyTheme(t)
  }

  return (
    <div className="ui-screen space-y-6">
      {/* Header */}
      <div className="px-1 flex items-center justify-between">
        <h1 className="text-base font-bold tracking-tight">Settings</h1>
        <span className="text-xs font-medium text-muted-foreground">v1.3.0</span>
      </div>

      {/* 1. Account & Card Section */}
      <SettingsGroup title="Burner Card Identity">
        {session ? (
          <>
            <div className="p-4 flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shadow-sm">
                  {accountName.slice(0, 2).toUpperCase() || 'BN'}
                </div>
                <div>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="text-[16px] font-semibold bg-muted px-2.5 py-1 min-h-[36px] rounded border border-border outline-none focus:border-primary transition-colors"
                        maxLength={24}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAccountName(nameInput.trim() || 'Burner Card')
                          setEditingName(false)
                        }}
                        className="text-xs font-semibold text-primary px-2 py-1 rounded hover:bg-muted"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold tracking-tight">
                        {accountName || 'Burner Card'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNameInput(accountName)
                          setEditingName(true)
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium underline px-1"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {shortAddress(session.address)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={copyAddress}
                  className="ui-pill-btn font-medium flex items-center gap-1 py-1 px-2.5"
                  aria-label="Copy address"
                >
                  {copied ? <CheckIcon size={13} className="text-primary" /> : <CopyIcon size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLock}
                  className="ui-pill-btn py-1 px-2.5 text-destructive hover:bg-destructive/10 font-medium"
                >
                  Lock
                </button>
              </div>
            </div>

            <SettingsRow
              label="PIN Cache Duration"
              sublabel="Skip PIN prompt on consecutive taps"
            >
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/50">
                {([0, 30, 120, 600] as const).map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => updateSettings({ pinCacheSeconds: secs })}
                    className={`text-xs px-2.5 py-1.5 min-h-[34px] rounded-md font-medium transition-all ${
                      (settings.pinCacheSeconds ?? 0) === secs
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {secs === 0 ? 'Never' : secs === 30 ? '30s' : secs === 120 ? '2m' : '10m'}
                  </button>
                ))}
              </div>
            </SettingsRow>
          </>
        ) : (
          <div className="p-4 text-center space-y-1.5">
            <div className="text-sm font-semibold">No card unlocked</div>
            <div className="text-xs text-muted-foreground">
              Tap your physical Burner NFC card to connect.
            </div>
          </div>
        )}
      </SettingsGroup>

      {/* 2. Preferences */}
      <SettingsGroup title="Preferences">
        {/* Theme Pill Toggle */}
        <SettingsRow label="Appearance" sublabel="Interface theme">
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/50">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`text-xs px-2.5 py-1.5 min-h-[34px] rounded-md capitalize font-medium transition-all ${
                  settings.theme === t
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </SettingsRow>

        {/* Currency Toggle */}
        <SettingsRow label="Currency" sublabel="Display fiat pricing">
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/50">
            {(['USD', 'EUR'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateSettings({ currency: c })}
                className={`text-xs px-2.5 py-1.5 min-h-[34px] rounded-md uppercase font-medium transition-all ${
                  settings.currency === c
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </SettingsRow>

        {/* Default Slippage */}
        <SettingsRow label="Default Slippage" sublabel="Max tolerance for swaps">
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/50">
            {[0.1, 0.5, 1.0, 3.0].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateSettings({ slippage: s })}
                className={`text-xs px-2 py-1.5 min-h-[34px] rounded-md font-medium transition-all ${
                  settings.slippage === s
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </SettingsRow>

        {/* Hide Small Balances */}
        <SettingsRow
          label="Hide Small Balances"
          sublabel="Filter out balances under $1.00 USD"
        >
          <input
            type="checkbox"
            checked={settings.hideSmall ?? false}
            onChange={(e) => updateSettings({ hideSmall: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
          />
        </SettingsRow>

        {/* Hide Spam Collectibles */}
        <SettingsRow
          label="Spam Filter"
          sublabel="Hide unverified or flagged NFTs"
        >
          <input
            type="checkbox"
            checked={settings.hideSpam ?? false}
            onChange={(e) => updateSettings({ hideSpam: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
          />
        </SettingsRow>

        {/* Show Testnets */}
        <SettingsRow
          label="Show Testnets"
          sublabel="Include Sepolia and Base Sepolia networks"
        >
          <input
            type="checkbox"
            checked={settings.showTestnets ?? false}
            onChange={(e) => {
              updateSettings({ showTestnets: e.target.checked })
              onSync()
            }}
            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
          />
        </SettingsRow>
      </SettingsGroup>

      {/* 3. Networks & Custom RPCs */}
      <SettingsGroup
        title="Active Networks"
        action={
          <button
            type="button"
            onClick={() => setCustomModal(true)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Add Network
          </button>
        }
      >
        {allChains(settings.showTestnets).map((c) => {
          const isEnabled =
            !settings.enabledChains || settings.enabledChains.includes(c.chain.id)
          return (
            <SettingsRow
              key={c.chain.id}
              label={c.chain.name}
              sublabel={`Chain ID: ${c.chain.id}`}
              icon={<span className="text-xs font-bold">{c.badge}</span>}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => {
                  const current =
                    settings.enabledChains ??
                    allChains(true).map((ch) => ch.chain.id)
                  const next = e.target.checked
                    ? [...current, c.chain.id]
                    : current.filter((id) => id !== c.chain.id)
                  updateSettings({ enabledChains: next })
                  onSync()
                }}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
            </SettingsRow>
          )
        })}
      </SettingsGroup>

      {/* Add Custom Network Modal */}
      {customModal && (
        <div className="ui-sheet-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ui-card w-full max-w-md p-4 space-y-3 bg-card border border-border shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold">Add Custom Chain</h3>
              <button
                type="button"
                onClick={() => setCustomModal(false)}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Chain ID</label>
                <input
                  type="text"
                  placeholder="e.g. 42161"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className="w-full text-[16px] min-h-[44px] px-3 py-2 rounded-lg bg-muted border border-border outline-none mt-1 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Network Name</label>
                <input
                  type="text"
                  placeholder="e.g. Arbitrum One"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-[16px] min-h-[44px] px-3 py-2 rounded-lg bg-muted border border-border outline-none mt-1 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">RPC URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.rpcUrl}
                  onChange={(e) => setForm({ ...form, rpcUrl: e.target.value })}
                  className="w-full text-[16px] min-h-[44px] px-3 py-2 rounded-lg bg-muted border border-border outline-none mt-1 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Block Explorer URL</label>
                <input
                  type="url"
                  placeholder="https://arbiscan.io"
                  value={form.explorer}
                  onChange={(e) => setForm({ ...form, explorer: e.target.value })}
                  className="w-full text-[16px] min-h-[44px] px-3 py-2 rounded-lg bg-muted border border-border outline-none mt-1 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomModal(false)}
                className="ui-btn ui-btn-outline flex-1 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!form.id || !form.name || !form.rpcUrl}
                onClick={() => {
                  const next = [
                    ...customs,
                    {
                      id: Number(form.id),
                      name: form.name.trim(),
                      rpcUrl: form.rpcUrl.trim(),
                      explorer: form.explorer.trim(),
                      nativeSymbol: form.nativeSymbol.trim().toUpperCase() || 'ETH',
                    },
                  ]
                  setCustoms(next)
                  saveCustomChains(next)
                  setCustomModal(false)
                  setForm({ id: '', name: '', rpcUrl: '', explorer: '', nativeSymbol: 'ETH' })
                  onSync()
                }}
                className="ui-btn ui-btn-primary flex-1 py-2 text-sm"
              >
                Save Chain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Testnet Faucets */}
      <SettingsGroup title="Testnet Faucets">
        {FAUCETS.map((f) => (
          <a
            key={f.url}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors"
          >
            <div>
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <span>{f.name}</span>
                <ExternalLinkIcon size={12} className="text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {f.gives} • {f.notes}
              </div>
            </div>
            <span className="ui-pill-btn text-[11px] font-semibold py-0.5 px-2">
              Visit ↗
            </span>
          </a>
        ))}
      </SettingsGroup>

      {/* 5. Diagnostics & Cache */}
      <SettingsGroup title="Maintenance">
        <SettingsRow
          label="Clear Local Cache"
          sublabel="Remove cached RPC state and restart session"
        >
          <button
            type="button"
            onClick={handleClearCache}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
          >
            Reset
          </button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  )
}
