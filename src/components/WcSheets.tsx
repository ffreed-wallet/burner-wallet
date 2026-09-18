import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getSdkError } from '@walletconnect/utils'
import { formatEther } from 'viem'
import { friendlyCardError, getCardAccount, shortAddress, signWithPinRetry } from '../lib/burner'
import { allChains } from '../lib/chains'
import { buildApproval, describeProposal } from '../lib/wc/namespaces'
import { getWcClient } from '../lib/wc/client'
import {
  decodePersonalSign,
  decodeSendTransaction,
  decodeSwitchChain,
  decodeTypedData,
  parseChainId,
  toChainHex,
  type DecodedMessage,
  type DecodedTx,
  type DecodedTypedData,
} from '../lib/wc/requests'
import { refreshWcSessions } from '../lib/wc/subscribe'
import { useWallet, type WcPendingReq } from '../store'
import { PinPrompt } from './PinPrompt'
import { SheetShell } from './SheetShell'
import { TapToSign } from './TapToSign'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'

/** Supported chain ids: everything in the registry incl. testnets. */
function supportedIds(): number[] {
  return allChains(true).map((c) => c.chain.id)
}

/** Minimal signer surface (viem `Account` is a union with optional sign fns). */
interface CardSigner {
  signMessage: (args: { message: `0x${string}` | string }) => Promise<`0x${string}`>
  signTypedData: (args: {
    domain: unknown
    types: unknown
    primaryType: string
    message: unknown
  }) => Promise<`0x${string}`>
}

/** Narrow the card account to a callable signer, or throw. */
function cardSigner(kind: 'signMessage' | 'signTypedData'): CardSigner {
  const account = getCardAccount()
  if (!account) throw new Error('Card not in session. Tap your card to continue.')
  const signer = account as unknown as Partial<CardSigner>
  if (typeof signer[kind] !== 'function') throw new Error('Card account cannot sign.')
  return signer as CardSigner
}

function chainLabel(id: number): string {
  const entry = allChains(true).find((c) => c.chain.id === id)
  return entry ? `${entry.chain.name} (#${id})` : `#${id}`
}

/** JSON-RPC error passed to `client.respond` for a failed request. */
export interface WcRpcError {
  code: number
  message: string
}

/** Respond once, then drop the pending request (guarded by request id). */
async function failReq(req: WcPendingReq, error: WcRpcError): Promise<void> {
  try {
    const wcClient = await getWcClient()
    await wcClient.respond({ topic: req.topic, response: { id: req.id, jsonrpc: '2.0', error } })
  } catch {
    /* fail closed */
  }
  const st = useWallet.getState()
  if (st.pendingReq?.id === req.id) st.clearReq()
}

/** Auto-reject on mount (no user action needed for these paths). */
function WcAutoReject({ req, error }: { req: WcPendingReq; error: WcRpcError }) {
  useEffect(() => {
    void failReq(req, error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.id, req.topic])
  return null
}

// ---------------------------------------------------------------------------
// Proposal sheet
// ---------------------------------------------------------------------------

/** Approve / reject a dApp session proposal (one NFC tap per signature later). */
export function WcProposalSheet() {
  const { proposal, clearProposal, session, requestScan, demo } = useWallet()
  const [busy, setBusy] = useState(false)
  const [needsCard, setNeedsCard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!proposal) return null

  const meta = proposal.proposer.metadata
  const desc = describeProposal(proposal, supportedIds())
  const address = session?.address

  const reject = async (reason?: { code: number; message: string }) => {
    setBusy(true)
    try {
      const wcClient = await getWcClient()
      await wcClient.reject({ id: proposal.id, reason: reason ?? getSdkError('USER_REJECTED') })
    } catch {
      /* fail closed */
    } finally {
      clearProposal()
      setBusy(false)
    }
  }

  const approve = async () => {
    setError(null)
    setNeedsCard(false)
    if (demo) {
      setError('DEMO MODE — pairing disabled. Use a real card session.')
      return
    }
    if (!address) {
      setNeedsCard(true)
      return
    }
    setBusy(true)
    try {
      const namespaces = buildApproval(proposal, address, supportedIds())
      const wcClient = await getWcClient()
      await wcClient.approve({ id: proposal.id, namespaces })
      await refreshWcSessions(useWallet)
    } catch (e) {
      // Zero chain overlap throws the UNSUPPORTED_CHAINS sdk error.
      const reason =
        e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'number'
          ? (e as { code: number; message: string })
          : getSdkError('USER_REJECTED')
      try {
        const wcClient = await getWcClient()
        await wcClient.reject({ id: proposal.id, reason })
      } catch {
        /* fail closed */
      }
      if (reason.code !== 4001) setError(`${reason.code}: ${reason.message}`)
    } finally {
      clearProposal()
      setBusy(false)
    }
  }

  return (
    <SheetShell
      label="WalletConnect proposal"
      title="Connect dApp"
      onClose={() => void reject()}
      footer={
        <>
          {needsCard ? (
            <Button
              size="lg"
              block
              onClick={() => {
                requestScan()
                clearProposal()
              }}
            >
              Tap card to connect
            </Button>
          ) : (
            <Button size="lg" block disabled={busy} onClick={() => void approve()}>
              {busy ? 'Connecting…' : 'Approve → tap to sign later'}
            </Button>
          )}
          <Button variant="outline" block disabled={busy} onClick={() => void reject()}>
            Reject
          </Button>
        </>
      }
    >
      <table className="ui-table">
        <tbody>
          <tr>
            <th>DApp</th>
            <td style={{ overflowWrap: 'anywhere' }}>{meta.name}</td>
          </tr>
          <tr>
            <th>URL</th>
            <td style={{ overflowWrap: 'anywhere' }}>{meta.url}</td>
          </tr>
          <tr>
            <th>Chains</th>
            <td>{desc.chains.length > 0 ? desc.chains.map(chainLabel).join(', ') : '—'}</td>
          </tr>
          {desc.unsupported.length > 0 && (
            <tr>
              <th>Skipped</th>
              <td>unsupported here: {desc.unsupported.map(chainLabel).join(', ')}</td>
            </tr>
          )}
          <tr>
            <th>Methods</th>
            <td style={{ overflowWrap: 'anywhere' }}>{desc.methods.join(', ') || '—'}</td>
          </tr>
          <tr>
            <th>Account</th>
            <td>{address ? shortAddress(address) : 'No card — tap first'}</td>
          </tr>
        </tbody>
      </table>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </SheetShell>
  )
}

// ---------------------------------------------------------------------------
// Request sheet (router)
// ---------------------------------------------------------------------------

const TYPED_METHODS = ['eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4']

/** Route the pending WalletConnect request to the right signer / reject path. */
export function WcRequestSheet() {
  const pendingReq = useWallet((s) => s.pendingReq)
  if (!pendingReq) return null
  return <WcRequestRouter key={pendingReq.id} req={pendingReq} />
}

function WcRequestRouter({ req }: { req: WcPendingReq }) {
  const numeric = parseChainId(req.chainId)

  if (req.method === 'eth_sendTransaction') return <WcSendTx req={req} numericChain={numeric} />
  if (req.method === 'personal_sign') return <WcPersonal req={req} numericChain={numeric} />
  if (TYPED_METHODS.includes(req.method)) return <WcTyped req={req} numericChain={numeric} />
  if (req.method === 'eth_sign') {
    return <WcAutoReject req={req} error={{ code: 4001, message: 'eth_sign is unsafe — ask the dApp to use personal_sign.' }} />
  }
  if (req.method === 'eth_signTransaction') {
    return <WcAutoReject req={req} error={{ code: 4200, message: 'eth_signTransaction not supported — use eth_sendTransaction.' }} />
  }
  if (req.method === 'wallet_switchEthereumChain') return <WcSwitch req={req} />
  if (req.method === 'wallet_addEthereumChain') {
    return (
      <WcAutoReject
        req={req}
        error={{ code: 4902, message: 'Chain not added — add it manually in MORE → NETWORKS, then retry.' }}
      />
    )
  }
  if (numeric == null) {
    return <WcAutoReject req={req} error={{ code: 5100, message: `Unsupported namespace scope "${req.chainId}".` }} />
  }
  return <WcAutoReject req={req} error={{ code: 4200, message: `Unsupported method "${req.method}".` }} />
}

/** Guard: chain scope must be a supported eip155 chain. Returns the id, or null while rejecting. */
function useCheckedChain(req: WcPendingReq, numeric: number | null): number | null {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    if (numeric == null || !supportedIds().includes(numeric)) {
      void failReq(req, {
        code: 4902,
        message: `Unrecognized chain "${req.chainId}" — enable it in MORE → NETWORKS.`,
      }).then(() => setOk(false))
    } else {
      setOk(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.id, req.topic])
  return ok === true ? numeric : null
}

// ---------------------------------------------------------------------------
// eth_sendTransaction → TapToSign
// ---------------------------------------------------------------------------

function WcSendTx({ req, numericChain }: { req: WcPendingReq; numericChain: number | null }) {
  const chainId = useCheckedChain(req, numericChain)
  const cardAddress = useWallet((s) => s.session?.address)

  let tx: DecodedTx | null = null
  let decodeError: string | null = null
  try {
    tx = decodeSendTransaction(req.params)
  } catch (e) {
    decodeError = e instanceof Error ? e.message : 'Bad transaction params.'
  }

  if (decodeError || !tx) {
    return <WcAutoReject req={req} error={{ code: -32602, message: decodeError ?? 'Bad transaction params.' }} />
  }
  if (chainId == null) return null
  if (tx.from && cardAddress && tx.from.toLowerCase() !== cardAddress.toLowerCase()) {
    return (
      <WcAutoReject
        req={req}
        error={{ code: 4001, message: `FROM ${tx.from} is not the card ${cardAddress} — rejected.` }}
      />
    )
  }

  const decoded = tx
  const entry = allChains(true).find((c) => c.chain.id === chainId)
  const nativePriceUsd = useWallet.getState().prices[entry?.chain.nativeCurrency.symbol.toUpperCase() ?? '']
  const lines = [
    { k: 'DAPP', v: req.dapp.name },
    { k: 'FROM', v: decoded.from ?? cardAddress ?? '—' },
    { k: 'TO', v: decoded.to ?? '(contract deploy)' },
    { k: 'VALUE', v: decoded.value != null ? `${formatEther(decoded.value)} ${entry?.chain.nativeCurrency.symbol ?? ''}` : '0' },
    { k: 'DATA', v: decoded.data ? `${decoded.data.slice(0, 66)}${decoded.data.length > 66 ? '…' : ''}` : '—' },
    { k: 'CHAIN', v: chainLabel(chainId) },
  ]
  if (decoded.nonce != null) lines.push({ k: 'NONCE', v: String(decoded.nonce) })

  return (
    <TapToSign
      open
      title="DAPP TX"
      lines={lines}
      chainId={chainId}
      gas={{ to: decoded.to, data: decoded.data, value: decoded.value, gasLimit: decoded.gasLimit }}
      nativePriceUsd={nativePriceUsd}
      buildTx={async () => {
        // dApp fee suggestions ride along in the base tx; the TapToSign
        // speed selector overlays wallet estimates on top. Explicit
        // gasLimit + nonce always pass through untouched.
        const base: Record<string, unknown> = { value: decoded.value ?? 0n }
        if (decoded.to) base.to = decoded.to
        if (decoded.data) base.data = decoded.data
        if (decoded.gasPrice != null) base.gasPrice = decoded.gasPrice
        if (decoded.maxFeePerGas != null) base.maxFeePerGas = decoded.maxFeePerGas
        if (decoded.maxPriorityFeePerGas != null) base.maxPriorityFeePerGas = decoded.maxPriorityFeePerGas
        if (decoded.nonce != null) base.nonce = decoded.nonce
        return base
      }}
      onDone={(hash) => {
        void (async () => {
          try {
            const wcClient = await getWcClient()
            await wcClient.respond({ topic: req.topic, response: { id: req.id, jsonrpc: '2.0', result: hash } })
          } catch {
            /* fail closed */
          }
          const st = useWallet.getState()
          if (st.pendingReq?.id === req.id) st.clearReq()
        })()
      }}
      onClose={() => void failReq(req, getSdkError('USER_REJECTED'))}
    />
  )
}

// ---------------------------------------------------------------------------
// personal_sign / signTypedData → TapToSignMessage
// ---------------------------------------------------------------------------

function WcPersonal({ req, numericChain }: { req: WcPendingReq; numericChain: number | null }) {
  const chainId = useCheckedChain(req, numericChain)
  const cardAddress = useWallet((s) => s.session?.address)

  let decoded: DecodedMessage | null = null
  let decodeError: string | null = null
  try {
    decoded = decodePersonalSign(req.params)
  } catch (e) {
    decodeError = e instanceof Error ? e.message : 'Bad sign params.'
  }

  if (decodeError || !decoded) {
    return <WcAutoReject req={req} error={{ code: -32602, message: decodeError ?? 'Bad sign params.' }} />
  }
  if (chainId == null) return null
  if (decoded.address && cardAddress && decoded.address.toLowerCase() !== cardAddress.toLowerCase()) {
    return (
      <WcAutoReject
        req={req}
        error={{ code: 4001, message: `Signer ${decoded.address} is not the card ${cardAddress} — rejected.` }}
      />
    )
  }
  return (
    <TapToSignMessage
      req={req}
      chainId={chainId}
      heading="SIGN MESSAGE"
      body={<MessageBody decoded={decoded} />}
      sign={async () => cardSigner('signMessage').signMessage({ message: decoded.message })}
    />
  )
}

function WcTyped({ req, numericChain }: { req: WcPendingReq; numericChain: number | null }) {
  const chainId = useCheckedChain(req, numericChain)
  const cardAddress = useWallet((s) => s.session?.address)

  let decoded: DecodedTypedData | null = null
  let decodeError: string | null = null
  try {
    decoded = decodeTypedData(req.params)
  } catch (e) {
    decodeError = e instanceof Error ? e.message : 'Bad typed-data params.'
  }

  if (decodeError || !decoded) {
    return <WcAutoReject req={req} error={{ code: -32602, message: decodeError ?? 'Bad typed-data params.' }} />
  }
  if (chainId == null) return null
  if (decoded.address && cardAddress && decoded.address.toLowerCase() !== cardAddress.toLowerCase()) {
    return (
      <WcAutoReject
        req={req}
        error={{ code: 4001, message: `Signer ${decoded.address} is not the card ${cardAddress} — rejected.` }}
      />
    )
  }
  const typed = decoded
  return (
    <TapToSignMessage
      req={req}
      chainId={chainId}
      heading="SIGN TYPED DATA"
      body={<TypedDataBody decoded={typed} />}
      sign={async () => {
        // EIP712Domain is derived from `domain` — strip it from types.
        const { EIP712Domain: _stripped, ...types } = typed.types as Record<string, unknown>
        void _stripped
        return cardSigner('signTypedData').signTypedData({
          domain: typed.domain,
          types,
          primaryType: typed.primaryType,
          message: typed.message,
        })
      }}
    />
  )
}

function MessageBody({ decoded }: { decoded: DecodedMessage }) {
  const shown = decoded.text ?? decoded.message
  return (
    <>
      <div className="ui-card ui-mono" style={{ padding: 12, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', fontSize: '0.8125rem' }}>
        {shown || '(empty message)'}
      </div>
      {decoded.opaque && (
        <Alert variant="destructive">
          <AlertTitle>Opaque hex</AlertTitle>
          <AlertDescription>
            Not readable text. Only sign if you trust {`"${decoded.address ?? 'this dApp'}"`} fully.
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}

function TypedDataBody({ decoded }: { decoded: DecodedTypedData }) {
  const domain = decoded.domain as Record<string, unknown>
  const domainLine = [
    typeof domain.name === 'string' ? domain.name : null,
    typeof domain.verifyingContract === 'string' ? domain.verifyingContract : null,
  ]
    .filter(Boolean)
    .join(' · ')
  let pretty: string | null = null
  try {
    pretty = JSON.stringify(decoded.message, null, 2)
  } catch {
    pretty = null
  }
  return (
    <>
      <table className="ui-table">
        <tbody>
          <tr>
            <th>Type</th>
            <td style={{ overflowWrap: 'anywhere' }}>{decoded.primaryType}</td>
          </tr>
          {domainLine && (
            <tr>
              <th>Domain</th>
              <td style={{ overflowWrap: 'anywhere' }}>{domainLine}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="ui-card ui-mono" style={{ padding: 12, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', fontSize: '0.8125rem' }}>
        {pretty ?? decoded.raw}
      </div>
    </>
  )
}

/**
 * Message-signing sheet: shows the decoded payload (+ opaque-hex warning),
 * then one NFC tap on the card signs. Resolves via `client.respond`.
 */
function TapToSignMessage({
  req,
  chainId,
  heading,
  body,
  sign,
}: {
  req: WcPendingReq
  chainId: number
  heading: string
  body: ReactNode
  sign: () => Promise<`0x${string}`>
}) {
  const { requestScan, demo } = useWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsCard, setNeedsCard] = useState(false)
  const done = useRef(false)
  // Sign-time PIN prompt (PIN-gated slots reject `sign` without a password).
  const [pinReason, setPinReason] = useState<'needed' | 'wrong' | null>(null)
  const pinWaiter = useRef<{ resolve: (v: string | null) => void } | null>(null)
  useEffect(
    () => () => {
      pinWaiter.current?.resolve(null)
      pinWaiter.current = null
    },
    [],
  )
  const askPin = (reason: 'needed' | 'wrong'): Promise<string | null> =>
    new Promise((resolve) => {
      pinWaiter.current = { resolve }
      setPinReason(reason)
    })
  const resolvePin = (v: string | null) => {
    pinWaiter.current?.resolve(v)
    pinWaiter.current = null
    setPinReason(null)
  }

  const closeReject = () => {
    if (!done.current) void failReq(req, getSdkError('USER_REJECTED'))
  }

  const tap = async () => {
    setError(null)
    setNeedsCard(false)
    if (demo) {
      setError('DEMO MODE — signing disabled. Use a real card session.')
      return
    }
    setBusy(true)
    try {
      const account = getCardAccount()
      if (!account) {
        setNeedsCard(true)
        throw new Error('Card not in session. Tap your card to continue.')
      }
      // One sign* call = one NFC tap on the card (PIN prompts here if gated).
      const sig = await signWithPinRetry(() => sign(), askPin)
      done.current = true
      try {
        const wcClient = await getWcClient()
        await wcClient.respond({ topic: req.topic, response: { id: req.id, jsonrpc: '2.0', result: sig } })
      } catch {
        /* fail closed */
      }
      const st = useWallet.getState()
      if (st.pendingReq?.id === req.id) st.clearReq()
    } catch (e) {
      setError(friendlyCardError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SheetShell
        label={heading}
        title={heading}
        onClose={closeReject}
        footer={
          <>
            {needsCard ? (
              <Button
                size="lg"
                block
                onClick={() => {
                  requestScan()
                  closeReject()
                }}
              >
                Tap card to connect
              </Button>
            ) : (
              <Button size="lg" block disabled={busy} onClick={() => void tap()}>
                {busy ? 'Hold card to phone…' : 'Tap card to sign'}
              </Button>
            )}
            <Button variant="outline" block onClick={closeReject}>
              Reject
            </Button>
          </>
        }
      >
        <table className="ui-table">
          <tbody>
            <tr>
              <th>DApp</th>
              <td style={{ overflowWrap: 'anywhere' }}>{req.dapp.name}</td>
            </tr>
            <tr>
              <th>Method</th>
              <td>{req.method}</td>
            </tr>
            <tr>
              <th>Chain</th>
              <td>{chainLabel(chainId)}</td>
            </tr>
          </tbody>
        </table>
        {body}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </SheetShell>
      {pinReason && (
        <PinPrompt
          reason={pinReason}
          onSubmit={(v) => resolvePin(v)}
          onCancel={() => resolvePin(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// wallet_switchEthereumChain → auto-approve when known
// ---------------------------------------------------------------------------

function WcSwitch({ req }: { req: WcPendingReq }) {
  const [error, setError] = useState<WcRpcError | null>(null)
  useEffect(() => {
    let target: number
    try {
      target = decodeSwitchChain(req.params)
    } catch {
      setError({ code: -32602, message: 'Missing chainId.' })
      return
    }
    if (!supportedIds().includes(target)) {
      setError({ code: 4902, message: `Unknown chain #${target} — add it manually in MORE → NETWORKS.` })
      return
    }
    // Known chain: auto-approve (respond null + emit chainChanged).
    void (async () => {
      try {
        const wcClient = await getWcClient()
        await wcClient.emit({
          topic: req.topic,
          event: { name: 'chainChanged', data: toChainHex(target) },
          chainId: req.chainId,
        })
        await wcClient.respond({ topic: req.topic, response: { id: req.id, jsonrpc: '2.0', result: null } })
      } catch {
        /* fail closed */
      }
      const st = useWallet.getState()
      if (st.pendingReq?.id === req.id) st.clearReq()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.id, req.topic])
  if (error) return <WcAutoReject req={req} error={error} />
  return null
}
