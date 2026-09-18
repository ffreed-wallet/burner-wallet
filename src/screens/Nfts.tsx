import { useMemo, useState } from 'react'
import { encodeFunctionData, erc721Abi, erc1155Abi, isAddress } from 'viem'
import { TapToSign } from '../components/TapToSign'
import { shortAddress } from '../lib/burner'
import { allChains } from '../lib/chains'
import { useWallet } from '../store'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { CloseIcon, NftIcon } from '../components/ui/icons'

export function Nfts() {
  const { nfts, session, settings } = useWallet()
  const [hiddenShown, setHiddenShown] = useState(false)
  const [selectedNftKey, setSelectedNftKey] = useState<string | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [to, setTo] = useState('')
  const [qty, setQty] = useState('1')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<string | null>(null)

  const chainMap = useMemo(() => new Map(allChains(true).map((c) => [c.chain.id, c] as const)), [])

  const visible = useMemo(
    () => nfts.filter((n) => hiddenShown || !(settings.hideSpam && n.isSpam)),
    [nfts, hiddenShown, settings.hideSpam],
  )
  const spamTotal = nfts.filter((n) => n.isSpam).length

  const keyFor = (chainId: number, contract: string, tokenId: string) =>
    `${chainId}:${contract.toLowerCase()}:${tokenId}`

  const selectedNft = useMemo(() => {
    if (!selectedNftKey) return null
    return nfts.find((n) => keyFor(n.chainId, n.contract, n.tokenId) === selectedNftKey) ?? null
  }, [nfts, selectedNftKey])

  const is1155 = (selectedNft?.tokenType ?? '').toUpperCase().includes('1155')
  const qtyValid = !is1155 || (/^\d+$/.test(qty.trim()) && Number(qty.trim()) >= 1)

  const closeSend = () => {
    setSendOpen(false)
    setTo('')
    setConfirmOpen(false)
    setQty('1')
  }

  return (
    <div className="ui-screen space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-base font-bold tracking-tight">NFT Collectibles</h1>
          <p className="text-xs text-muted-foreground">
            {visible.length} item{visible.length === 1 ? '' : 's'} in wallet
          </p>
        </div>
        {spamTotal > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHiddenShown(!hiddenShown)}
            className="text-xs h-7 px-2.5"
          >
            {hiddenShown ? 'Hide spam' : `Spam (${spamTotal})`}
          </Button>
        )}
      </div>

      {done && (
        <Alert>
          <AlertDescription className="ui-mono text-xs">Sent NFT ✓ {done}</AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {visible.length === 0 && (
        <div className="ui-card p-8 text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <NftIcon size={24} />
          </div>
          <h3 className="text-sm font-semibold">No NFTs found</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Collectibles sent to this address on Ethereum, Base, Polygon or other networks will appear
            here.
          </p>
        </div>
      )}

      {/* Grid of NFTs (Rainbow style cards) */}
      <div className="grid grid-cols-2 gap-3">
        {visible.map((n) => {
          const key = keyFor(n.chainId, n.contract, n.tokenId)
          const imgBroken = imgErr[key] === true
          const chainBadge = chainMap.get(n.chainId)?.badge
          const name = n.name ?? `#${n.tokenId}`

          return (
            <div
              key={key}
              onClick={() => {
                setSelectedNftKey(key)
                setSendOpen(true)
                setDone(null)
              }}
              className="ui-nft-card group cursor-pointer"
            >
              <div className="ui-nft-thumb">
                {n.image && !imgBroken ? (
                  <img
                    src={n.image}
                    alt={name}
                    loading="lazy"
                    onError={() => setImgErr((p) => ({ ...p, [key]: true }))}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground font-bold text-lg">
                    {name.charAt(0)}
                  </div>
                )}
                {chainBadge && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="outline" className="bg-card/80 backdrop-blur-md text-[10px] py-0 px-1 font-mono">
                      {chainBadge}
                    </Badge>
                  </div>
                )}
                {n.isSpam && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="destructive" className="text-[10px] py-0 px-1">
                      Spam
                    </Badge>
                  </div>
                )}
              </div>

              <div className="p-2.5">
                <div className="font-bold text-xs truncate">{name}</div>
                {n.collection && (
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {n.collection}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{n.tokenType ?? 'ERC721'}</span>
                  <span className="text-primary font-semibold group-hover:underline">Send →</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* NFT Detail & Send Sheet */}
      {sendOpen && selectedNft && (
        <div className="ui-sheet-overlay" onClick={closeSend}>
          <div
            className="ui-sheet-content space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="ui-sheet-grabber">
              <span />
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">NFT Details</h2>
              <button
                type="button"
                onClick={closeSend}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="flex gap-3 items-center p-2 rounded-xl bg-muted/40">
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                {selectedNft.image ? (
                  <img src={selectedNft.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold">#</div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{selectedNft.name ?? `#${selectedNft.tokenId}`}</div>
                <div className="text-xs text-muted-foreground truncate">{selectedNft.collection ?? 'Unknown Collection'}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px] py-0">
                    {chainMap.get(selectedNft.chainId)?.chain.name ?? `#${selectedNft.chainId}`}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {shortAddress(selectedNft.contract)}
                  </span>
                </div>
              </div>
            </div>

            {/* Transfer form */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label htmlFor="send-nft-to" className="text-xs font-semibold text-muted-foreground uppercase">
                  Transfer to address
                </label>
                <input
                  id="send-nft-to"
                  placeholder="0x…"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="ui-input text-xs font-mono"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {to !== '' && !isAddress(to) && (
                  <span className="text-xs text-rose-500">Enter a valid 0x address.</span>
                )}
              </div>

              {is1155 && (
                <div className="space-y-1">
                  <label htmlFor="send-nft-qty" className="text-xs font-semibold text-muted-foreground uppercase">
                    Quantity (ERC-1155)
                  </label>
                  <input
                    id="send-nft-qty"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="ui-input text-xs"
                  />
                </div>
              )}

              <Button
                block
                size="lg"
                disabled={!isAddress(to) || !qtyValid || !session}
                onClick={() => setConfirmOpen(true)}
                className="ui-btn-glow mt-2"
              >
                Review Transfer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TapToSign modal */}
      {selectedNft && session && (
        <TapToSign
          open={confirmOpen && isAddress(to)}
          title="Send NFT"
          chainId={selectedNft.chainId}
          lines={[
            { k: 'NFT', v: `${selectedNft.collection ?? ''} #${selectedNft.tokenId}` },
            { k: 'Contract', v: selectedNft.contract },
            { k: 'To', v: to },
            ...(is1155 ? [{ k: 'Qty', v: qty.trim() }] : []),
          ]}
          buildTx={async () => {
            if (!isAddress(to)) throw new Error('Enter a valid address.')
            let tokenId: bigint
            try {
              tokenId = BigInt(selectedNft.tokenId)
            } catch {
              throw new Error('Unsupported token ID format.')
            }
            if (is1155) {
              const amount = BigInt(qty.trim())
              return {
                to: selectedNft.contract,
                data: encodeFunctionData({
                  abi: erc1155Abi,
                  functionName: 'safeTransferFrom',
                  args: [session.address, to as `0x${string}`, tokenId, amount, '0x' as `0x${string}`],
                }),
                value: 0n,
              }
            }
            return {
              to: selectedNft.contract,
              data: encodeFunctionData({
                abi: erc721Abi,
                functionName: 'safeTransferFrom',
                args: [session.address, to as `0x${string}`, tokenId],
              }),
              value: 0n,
            }
          }}
          onDone={(h) => {
            setDone(h)
            closeSend()
          }}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
