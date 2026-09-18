import { create } from 'zustand'
import { loadSavedAddress } from './lib/burner'
import type { BurnerSession } from './lib/burner'
import type { ActivityItem, NftItem, TokenBalance } from './lib/portfolio'
import type { WcProposal, WcSession } from './lib/wc/client'

export type Theme = 'light' | 'dark' | 'system'
export type Tab = 'home' | 'nfts' | 'swap' | 'activity' | 'connect' | 'more'

interface Settings {
  theme: Theme
  currency: 'USD' | 'EUR'
  slippage: number
  hideSmall: boolean
  hideSpam: boolean
  hideBalances: boolean
  showTestnets: boolean
  enabledChains: number[] | null // null = all
  /** Card PIN memory, seconds (0 = ask every time). RAM only, never stored. */
  pinCacheSeconds: number
}

export interface WalletState {
  session: BurnerSession | null
  setSession: (s: BurnerSession | null) => void

  tab: Tab
  setTab: (t: Tab) => void

  settings: Settings
  updateSettings: (p: Partial<Settings>) => void

  tokens: TokenBalance[]
  nfts: NftItem[]
  activity: ActivityItem[]
  prices: Record<string, number>
  lastSync: number | null
  syncing: boolean
  setPortfolio: (p: {
    tokens: TokenBalance[]
    nfts: NftItem[]
    activity: ActivityItem[]
    prices: Record<string, number>
  }) => void
  setSyncing: (b: boolean) => void

  contacts: { name: string; address: string }[]
  addContact: (c: { name: string; address: string }) => void
  removeContact: (address: string) => void

  /** Hashes broadcast this session (cleared on refresh) — TXs tab badge. */
  pendingTxs: string[]
  addPendingTx: (h: string) => void
  clearPendingTxs: () => void

  /** Increment to request the ScanSheet from anywhere (e.g. TapToSign). */
  scanRequests: number
  requestScan: () => void

  /** Bump to dismiss every open sheet (navbar tab switches). */
  sheetEpoch: number
  dismissSheets: () => void

  /** Wallet nickname (old-app AccountName parity), shown in header. */
  accountName: string
  setAccountName: (n: string) => void

  /** Demo mode (?demo=1): mock data, signing disabled. */
  demo: boolean
  setDemo: (b: boolean) => void

  /** Watched ERC-20s (zero-balance friendly), persisted to localStorage. */
  tracked: { chainId: number; address: string }[]
  addTracked: (c: { chainId: number; address: string }) => void
  removeTracked: (chainId: number, address: string) => void

  /** Token symbols hidden from Home (user-removed), persisted to localStorage. */
  hiddenTokens: string[]
  hideToken: (symbol: string) => void
  unhideToken: (symbol: string) => void
  clearHiddenTokens: () => void

  // ---- WalletConnect (append-only slice; existing slices untouched) ----
  /** Pending dApp session proposal, or null. */
  proposal: WcProposal | null
  setProposal: (p: WcProposal) => void
  clearProposal: () => void
  /** Active WalletConnect sessions. */
  sessions: WcSession[]
  setSessions: (s: WcSession[]) => void
  /** Single pending session request (one tap = one signature). */
  pendingReq: WcPendingReq | null
  enqueueReq: (r: WcPendingReq) => void
  clearReq: () => void
}

/** Minimal dApp identity for WalletConnect sheets. */
export interface WcDapp {
  name: string
  url: string
  icon?: string
}

/** One pending WalletConnect session request. */
export interface WcPendingReq {
  id: number
  topic: string
  method: string
  params: unknown
  chainId: string
  dapp: WcDapp
}

const SETTINGS_KEY = 'burner.settings'
const CONTACTS_KEY = 'burner.contacts'
const TRACKED_KEY = 'burner.tracked'
const HIDDEN_KEY = 'burner.hiddenTokens'

function loadSettings(): Settings {
  const fallback: Settings = {
    theme: 'system',
    currency: 'USD',
    slippage: 0.5,
    hideSmall: true,
    hideSpam: true,
    hideBalances: false,
    showTestnets: false,
    enabledChains: null,
    pinCacheSeconds: 60,
  }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return fallback
  }
}

function loadContacts(): { name: string; address: string }[] {
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function loadTracked(): { chainId: number; address: string }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TRACKED_KEY) ?? '[]') as {
      chainId: number
      address: string
    }[]
    return Array.isArray(raw)
      ? raw.filter((t) => Number.isInteger(t?.chainId) && typeof t?.address === 'string')
      : []
  } catch {
    return []
  }
}

function loadHiddenTokens(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown
    return Array.isArray(raw)
      ? [...new Set(raw.filter((s): s is string => typeof s === 'string').map((s) => s.toUpperCase()))]
      : []
  } catch {
    return []
  }
}

export const useWallet = create<WalletState>()((set) => ({
  // Restore persisted card address (public info) so balances load without
  // re-tapping — same pattern as the old ff freed-wallet app. The card is
  // still required for every signature.
  session: (() => {
    const a = loadSavedAddress()
    return a ? { address: a } : null
  })(),
  setSession: (session) => set({ session }),

  tab: 'home',
  setTab: (tab) => set({ tab }),

  settings: loadSettings(),
  updateSettings: (p) =>
    set((s) => {
      const settings = { ...s.settings, ...p }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      return { settings }
    }),

  tokens: [],
  nfts: [],
  activity: [],
  prices: {},
  lastSync: null,
  syncing: false,
  setPortfolio: (p) => set({ ...p, lastSync: Date.now(), syncing: false }),
  setSyncing: (syncing) => set({ syncing }),

  contacts: loadContacts(),
  addContact: (c) =>
    set((s) => {
      const addr = c.address.toLowerCase()
      const contacts = [...s.contacts.filter((x) => x.address.toLowerCase() !== addr), c]
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts))
      return { contacts }
    }),
  removeContact: (address) =>
    set((s) => {
      const addr = address.toLowerCase()
      const contacts = s.contacts.filter((c) => c.address.toLowerCase() !== addr)
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts))
      return { contacts }
    }),

  pendingTxs: [],
  addPendingTx: (h) => set((s) => ({ pendingTxs: [...s.pendingTxs, h] })),
  clearPendingTxs: () => set({ pendingTxs: [] }),

  scanRequests: 0,
  requestScan: () => set((s) => ({ scanRequests: s.scanRequests + 1 })),

  sheetEpoch: 0,
  dismissSheets: () => set((s) => ({ sheetEpoch: s.sheetEpoch + 1 })),

  accountName: (() => {
    try {
      return localStorage.getItem('burner.accountName') ?? ''
    } catch {
      return ''
    }
  })(),
  setAccountName: (n) => {
    try {
      localStorage.setItem('burner.accountName', n)
    } catch {
      /* private mode */
    }
    set({ accountName: n })
  },

  demo: false,
  setDemo: (demo) => set({ demo }),

  tracked: loadTracked(),
  addTracked: (c) =>
    set((s) => {
      const addr = c.address.toLowerCase()
      if (s.tracked.some((t) => t.chainId === c.chainId && t.address.toLowerCase() === addr)) {
        return s
      }
      const tracked = [...s.tracked, { chainId: c.chainId, address: c.address }]
      localStorage.setItem(TRACKED_KEY, JSON.stringify(tracked))
      return { tracked }
    }),
  removeTracked: (chainId, address) =>
    set((s) => {
      const addr = address.toLowerCase()
      const tracked = s.tracked.filter(
        (t) => !(t.chainId === chainId && t.address.toLowerCase() === addr),
      )
      localStorage.setItem(TRACKED_KEY, JSON.stringify(tracked))
      return { tracked }
    }),

  hiddenTokens: loadHiddenTokens(),
  hideToken: (symbol) =>
    set((s) => {
      const key = symbol.toUpperCase()
      if (s.hiddenTokens.includes(key)) return s
      const hiddenTokens = [...s.hiddenTokens, key]
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenTokens))
      } catch {
        /* private mode */
      }
      return { hiddenTokens }
    }),
  unhideToken: (symbol) =>
    set((s) => {
      const key = symbol.toUpperCase()
      const hiddenTokens = s.hiddenTokens.filter((t) => t !== key)
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenTokens))
      } catch {
        /* private mode */
      }
      return { hiddenTokens }
    }),
  clearHiddenTokens: () => {
    try {
      localStorage.setItem(HIDDEN_KEY, '[]')
    } catch {
      /* private mode */
    }
    set({ hiddenTokens: [] })
  },

  // ---- WalletConnect ----
  proposal: null,
  setProposal: (proposal) => set({ proposal }),
  clearProposal: () => set({ proposal: null }),
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  pendingReq: null,
  enqueueReq: (req) => set((s) => (s.pendingReq ? s : { pendingReq: req })),
  clearReq: () => set({ pendingReq: null }),
}))

/** Apply light/dark/system to <html> (.dark class + data-theme) + PWA theme-color. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#1c1c1c' : '#ffffff')
}
