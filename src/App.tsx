import { useCallback, useEffect, useState } from 'react'
import { AppBar, TabBar } from './components/chrome'
import { InstallPrompt } from './components/InstallPrompt'
import { ScanSheet } from './components/ScanSheet'
import { WcProposalSheet, WcRequestSheet } from './components/WcSheets'
import { Button } from './components/ui/button'
import { DEMO_ADDRESS, DEMO_PORTFOLIO, isDemoMode } from './lib/demo'
import { syncPortfolio } from './lib/sync'
import { refreshTokenList } from './lib/tokenLists'
import { subscribeWc } from './lib/wc/subscribe'
import { Activity } from './screens/Activity'
import { Connect } from './screens/Connect'
import { Home } from './screens/Home'
import { More } from './screens/More'
import { Nfts } from './screens/Nfts'
import { Receive } from './screens/Receive'
import { Send } from './screens/Send'
import { Swap } from './screens/Swap'
import { applyTheme, useWallet } from './store'
import { SparklesIcon } from './components/ui/icons'

export default function App() {
  const {
    tab,
    session,
    settings,
    setSyncing,
    setPortfolio,
    clearPendingTxs,
    scanRequests,
  } = useWallet()

  const [overlay, setOverlay] = useState<'send' | 'receive' | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const demo = isDemoMode()

  // Leave demo mode: drop ?demo from the URL so it survives reloads,
  // clear the mock session + portfolio, land back on the locked screen.
  const exitDemo = useCallback(() => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('demo')
      window.history.replaceState(null, '', url.toString())
    } catch {
      /* non-browser — ignore */
    }
    useWallet.setState({
      demo: false,
      session: null,
      tokens: [],
      nfts: [],
      activity: [],
      prices: {},
      lastSync: null,
      syncing: false,
      pendingTxs: [],
    })
    setOverlay(null)
  }, [])

  // One-time startup: theme, optional demo seed, token-list cache.
  useEffect(() => {
    applyTheme(settings.theme)

    if (demo) {
      useWallet.setState({
        session: { address: DEMO_ADDRESS },
        demo: true,
      })
      setPortfolio(DEMO_PORTFOLIO)
    } else {
      void refreshTokenList()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open the scan sheet when any flow requests the card.
  useEffect(() => {
    if (scanRequests > 0) setScanOpen(true)
  }, [scanRequests])

  // Navbar tab switches close the Send/Receive overlays (sheets inside them
  // dismiss themselves via the store sheetEpoch signal).
  useEffect(() => {
    setOverlay(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // WalletConnect: proposals + session requests.
  useEffect(() => subscribeWc(useWallet), [])

  const sync = useCallback(async () => {
    if (!session) return
    setSyncing(true)
    try {
      const p = await syncPortfolio(session.address, {
        showTestnets: settings.showTestnets,
        enabledChains: settings.enabledChains,
      })
      setPortfolio(p)
      clearPendingTxs()
    } catch {
      setSyncing(false)
    }
  }, [
    session,
    settings.showTestnets,
    settings.enabledChains,
    setPortfolio,
    setSyncing,
    clearPendingTxs,
  ])

  useEffect(() => {
    if (session && !demo) void sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.address])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar onScan={() => setScanOpen(true)} />
      <InstallPrompt />
      {demo && (
        <div className="bg-primary/10 border-b border-primary/20 py-1.5 px-3 text-center text-xs font-medium text-primary flex items-center justify-center gap-1.5">
          <SparklesIcon size={14} />
          <span>Demo mode — mock card & balances</span>
          <button
            type="button"
            onClick={exitDemo}
            className="font-bold underline underline-offset-2 hover:opacity-80"
          >
            Exit
          </button>
        </div>
      )}
      <main className="flex flex-1 flex-col">
        {!session ? (
          <div className="ui-screen my-auto justify-center">
            <div className="ui-hero-card text-center space-y-4 py-10 px-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Burner Wallet</h1>
                <p className="text-[13px] leading-relaxed text-muted-foreground mt-1.5 max-w-[260px] mx-auto">
                  Mobile companion for your burner.pro NFC card. Hardware-secured crypto in your pocket.
                </p>
              </div>

              <div className="pt-2">
                <Button size="lg" block onClick={() => setScanOpen(true)} className="ui-btn-glow">
                  Tap Card to Unlock
                </Button>
              </div>

              <div className="text-[11px] font-medium tracking-wide text-muted-foreground pt-1">
                Ethereum · Base · Polygon · Optimism · Arbitrum
              </div>

              <div className="pt-2">
                <a
                  href="/?demo=1"
                  className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <span>Explore Demo Wallet</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          </div>
        ) : overlay === 'send' ? (
          <Send onBack={() => setOverlay(null)} />
        ) : overlay === 'receive' ? (
          <Receive onBack={() => setOverlay(null)} />
        ) : tab === 'home' ? (
          <Home
            onSync={sync}
            onSend={() => setOverlay('send')}
            onReceive={() => setOverlay('receive')}
          />
        ) : tab === 'nfts' ? (
          <Nfts />
        ) : tab === 'swap' ? (
          <Swap />
        ) : tab === 'activity' ? (
          <Activity />
        ) : tab === 'connect' ? (
          <Connect />
        ) : (
          <More onSync={sync} />
        )}
      </main>

      <TabBar />

      <ScanSheet open={scanOpen} onClose={() => setScanOpen(false)} />
      <WcProposalSheet />
      <WcRequestSheet />
    </div>
  )
}
