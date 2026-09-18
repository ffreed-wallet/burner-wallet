import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { parseEther } from 'viem'
import { shortAddress } from '../lib/burner'
import { allChains } from '../lib/chains'
import { useEnsProfile } from '../lib/ens'
import { useWallet } from '../store'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { CopyIcon, CheckIcon, SparklesIcon, ArrowLeftIcon } from '../components/ui/icons'

/**
 * Receive / Deposit screen:
 * Rainbow / Rabby style presentation with clean QR code plaque,
 * 1-tap copy, ENS resolution, and multi-chain badge support.
 */
export function Receive({ onBack }: { onBack?: () => void } = {}) {
  const { session } = useWallet()
  const ens = useEnsProfile(session?.address)
  const [copied, setCopied] = useState(false)
  const [expandedReq, setExpandedReq] = useState(false)
  const [reqAmount, setReqAmount] = useState('')

  const chains = useMemo(() => allChains(false), [])

  const wei = useMemo(() => {
    const raw = reqAmount.trim().replace(/,/g, '.')
    if (!raw) return null
    if (!/^\d+(\.\d+)?$/.test(raw)) return null
    try {
      const w = parseEther(raw)
      return w > 0n ? w : null
    } catch {
      return null
    }
  }, [reqAmount])

  if (!session) return null

  const qrValue =
    wei != null ? `ethereum:${session.address}?value=${wei.toString()}` : session.address
  const displayName = ens.name ? ens.name : shortAddress(session.address)

  const copyAddr = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(session.address)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="ui-screen space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeftIcon size={20} />
            </button>
          )}
          <h1 className="text-base font-bold tracking-tight">Receive Crypto</h1>
        </div>
        <Badge variant="outline" className="text-[11px] font-mono py-0.5">
          Multi-Chain EVM
        </Badge>
      </div>

      {/* Unified QR Plaque */}
      <div className="ui-receive-card">
        {/* Wallet Avatar & ENS Header */}
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-emerald-600 text-white font-bold text-sm shadow-sm">
            {ens.avatar ? (
              <img src={ens.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <span>{displayName}</span>
              {ens.name && <Badge variant="success" className="text-[10px] py-0">ENS</Badge>}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {shortAddress(session.address)}
            </div>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="ui-qr-container">
          <QRCodeSVG
            value={qrValue}
            size={200}
            level="M"
            includeMargin
            className="w-full h-auto max-w-[200px]"
          />
        </div>

        {/* Full Address Chip */}
        <div
          onClick={copyAddr}
          className="ui-address-pill mt-4 group cursor-pointer"
          role="button"
          tabIndex={0}
          title="Click to copy full address"
        >
          <span className="font-mono text-[11px] sm:text-xs tracking-tight break-all select-all text-muted-foreground group-hover:text-foreground transition-colors">
            {session.address}
          </span>
        </div>

        {/* Copy Address Primary Button */}
        <div className="mt-4 w-full">
          <Button
            block
            size="lg"
            variant={copied ? 'secondary' : 'default'}
            onClick={copyAddr}
            className="ui-btn-glow flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <CheckIcon size={18} className="text-emerald-500" />
                <span className="text-emerald-600 font-semibold">Address Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon size={18} />
                <span>Copy Address</span>
              </>
            )}
          </Button>
        </div>

        {/* Amount Request Toggle */}
        <div className="mt-3 w-full text-center">
          {!expandedReq ? (
            <button
              type="button"
              onClick={() => setExpandedReq(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer"
            >
              + Request specific amount
            </button>
          ) : (
            <div className="ui-amount-req-box mt-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0 ETH"
                  value={reqAmount}
                  onChange={(e) => setReqAmount(e.target.value)}
                  className="ui-input flex-1 h-9 text-xs"
                />
                <Button size="sm" variant="ghost" onClick={() => { setReqAmount(''); setExpandedReq(false) }}>
                  Cancel
                </Button>
              </div>
              {reqAmount && (
                <p className="text-[11px] text-muted-foreground mt-1 text-left">
                  QR code updated with requested amount.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multi-chain Network Compatibility Card */}
      <div className="ui-card p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <SparklesIcon size={15} className="text-emerald-500" />
          <span>Supported EVM Networks</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Your burner wallet address is identical across all supported EVM chains:
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {chains.map((c) => (
            <Badge key={c.chain.id} variant="outline" className="text-xs py-1 px-2">
              <span className="font-semibold mr-1">{c.badge}</span> {c.chain.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
