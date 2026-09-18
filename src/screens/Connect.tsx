import { useEffect, useState } from 'react'
import { getSdkError } from '@walletconnect/utils'
import { QrScanner } from '../components/QrScanner'
import { getWcClient, isWcConfigured, type WcSession } from '../lib/wc/client'
import { useWallet } from '../store'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ConnectIcon, ScanIcon } from '../components/ui/icons'

function sessionChains(s: WcSession): { namespace: string; id: number | null; raw: string }[] {
  const out: { namespace: string; id: number | null; raw: string }[] = []
  for (const [ns, val] of Object.entries(s.namespaces)) {
    for (const a of val.accounts ?? []) {
      const parts = a.split(':')
      const n = parts.length >= 2 ? Number(parts[1]) : NaN
      out.push({ namespace: ns, id: Number.isInteger(n) ? n : null, raw: a })
    }
  }
  return out
}

function validateWcUri(raw: string): string | null {
  const u = raw.trim()
  if (!u.startsWith('wc:')) return 'Need a wc:… URI from the dApp — paste or scan its QR.'
  if (!/^wc:[^@]+@2\?.*relay-protocol=.*&.*symKey=/.test(u) && !/^wc:[^@]+@2\?.*symKey=.*&.*relay-protocol=/.test(u)) {
    if (!/@2\?/.test(u)) return 'That looks like an old v1 pairing URI — only WalletConnect v2 is supported.'
    return 'That pairing URI looks incomplete or expired — check the dApp QR and try again.'
  }
  return null
}

function friendlyWcError(e: unknown): string {
  const msg = e instanceof Error ? e.message : 'Pairing failed.'
  if (/expired/i.test(msg)) return 'Pairing QR expired — generate a fresh one in the dApp.'
  if (/invalid|missing.*topic|malformed/i.test(msg)) return 'Invalid pairing URI — paste the full wc:… URL.'
  if (/network|fetch|websocket|relay/i.test(msg)) return 'Relay unreachable — check network, retry later.'
  return msg
}

export function Connect() {
  const { sessions, setSessions } = useWallet()
  const [uri, setUri] = useState('')
  const [busy, setBusy] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [awaitingApproval, setAwaitingApproval] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const configured = isWcConfigured()

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    setReady(false)
    setError(null)
    void getWcClient()
      .then((c) => {
        if (cancelled) return
        setReady(true)
        setSessions(c.session.values)
      })
      .catch((e) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : ''
          setError(
            /projectId|project id|api key/i.test(msg)
              ? `WalletConnect init failed: ${msg} — check VITE_WALLETCONNECT_PROJECT_ID.`
              : `WalletConnect init failed${msg ? `: ${msg}` : ''} — check network, then retry.`,
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [configured, setSessions])

  const pair = async (raw?: string) => {
    if (!ready || busy) return
    const u = (raw ?? uri).trim()
    const shapeError = validateWcUri(u)
    if (shapeError) {
      setUri(u)
      setError(shapeError)
      return
    }
    setBusy(true)
    setError(null)
    setAwaitingApproval(false)
    try {
      const wcClient = await getWcClient()
      await wcClient.pair({ uri: u })
      setUri('')
      setSessions(wcClient.session.values)
      setAwaitingApproval(true)
      window.setTimeout(() => setAwaitingApproval(false), 30000)
    } catch (e) {
      setError(friendlyWcError(e))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (topic: string) => {
    if (disconnecting) return
    setError(null)
    setDisconnecting(topic)
    try {
      const wcClient = await getWcClient()
      await wcClient.disconnect({ topic, reason: getSdkError('USER_DISCONNECTED') })
      setSessions(wcClient.session.values)
      const st = useWallet.getState()
      if (st.pendingReq?.topic === topic) st.clearReq()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed.')
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="ui-screen space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-base font-bold tracking-tight">Connected dApps</h1>
          <p className="text-xs text-muted-foreground">
            WalletConnect v2 · Link to Uniswap, Aave, OpenSea
          </p>
        </div>
        <Badge variant={ready ? 'success' : 'outline'} className="text-xs py-0.5">
          {ready ? 'Ready ✓' : 'Connecting…'}
        </Badge>
      </div>

      {/* Pairing Card */}
      <div className="ui-card p-3.5 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          New Connection
        </div>

        <Button
          variant="default"
          block
          size="lg"
          onClick={() => setScanOpen(true)}
          disabled={!ready || busy}
          className="flex items-center justify-center gap-2"
        >
          <ScanIcon size={18} />
          <span>Scan dApp QR Code</span>
        </Button>

        <div className="flex items-center gap-2">
          <div className="h-px bg-border flex-1" />
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">or paste URI</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <div className="flex gap-2">
          <input
            placeholder="Paste wc:… URI here"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            className="ui-input text-xs font-mono flex-1"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            size="sm"
            disabled={busy || !ready || !uri.trim()}
            onClick={() => void pair()}
            aria-busy={busy}
          >
            {busy ? 'Pairing…' : 'Connect'}
          </Button>
        </div>

        {awaitingApproval && (
          <Alert>
            <AlertDescription className="text-xs">
              Pairing sent — approve the session proposal in the popup sheet.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>WalletConnect</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Active Sessions */}
      <div className="ui-card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Sessions ({sessions.length})
          </span>
          <Badge variant={sessions.length > 0 ? 'success' : 'outline'} className="text-[10px] py-0">
            {sessions.length} live
          </Badge>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <ConnectIcon size={24} />
            </div>
            <h3 className="text-sm font-semibold">No active connections</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Scan a WalletConnect QR code from any decentralized application to connect your burner card.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((s) => {
              const chainsList = sessionChains(s)
              const iconUrl = s.peer.metadata.icons?.[0]
              return (
                <div key={s.topic} className="p-3 flex items-center justify-between gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ConnectIcon size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{s.peer.metadata.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.peer.metadata.url}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {chainsList.map((c, i) => (
                        <Badge key={`${c.namespace}-${c.id ?? 'na'}-${i}`} variant="outline" className="text-[10px] py-0 px-1 font-mono">
                          {c.id != null ? `#${c.id}` : c.namespace}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void disconnect(s.topic)}
                    disabled={disconnecting === s.topic}
                    className="text-xs shrink-0"
                  >
                    {disconnecting === s.topic ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {scanOpen && (
        <QrScanner
          hint="Point camera at the dApp's WalletConnect QR."
          onScan={(raw) => {
            setScanOpen(false)
            setUri(raw.trim())
            if (validateWcUri(raw) == null) void pair(raw)
            else setError(validateWcUri(raw))
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  )
}
