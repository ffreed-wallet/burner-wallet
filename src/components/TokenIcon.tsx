import { useState } from 'react'

const TOKEN_COLORS: Record<string, { bg: string; text: string }> = {
  ETH: { bg: '#627EEA', text: '#ffffff' },
  WETH: { bg: '#EC1C24', text: '#ffffff' },
  USDC: { bg: '#2775CA', text: '#ffffff' },
  USDT: { bg: '#26A17B', text: '#ffffff' },
  DAI: { bg: '#F5AC37', text: '#ffffff' },
  WBTC: { bg: '#F7931A', text: '#ffffff' },
  ARB: { bg: '#28A0F0', text: '#ffffff' },
  OP: { bg: '#FF0420', text: '#ffffff' },
  POL: { bg: '#8247E5', text: '#ffffff' },
  MATIC: { bg: '#8247E5', text: '#ffffff' },
  UNI: { bg: '#FF007A', text: '#ffffff' },
  LINK: { bg: '#375BD2', text: '#ffffff' },
}

/** Token logo with ticker fallback + subtle chain badge overlay (Rainbow style). */
export function TokenIcon({
  logo,
  symbol,
  chainBadge,
  size = 36,
}: {
  logo?: string
  symbol: string
  chainBadge?: string
  size?: number
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const cleanSymbol = symbol.trim().toUpperCase()
  const stylePreset = TOKEN_COLORS[cleanSymbol] ?? {
    bg: 'var(--muted)',
    text: 'var(--foreground)',
  }

  const showImg = Boolean(logo && !imgFailed)

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full overflow-visible select-none"
      style={{
        width: size,
        height: size,
      }}
      aria-hidden
    >
      <span
        className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: showImg ? 'var(--card)' : stylePreset.bg,
          color: showImg ? 'inherit' : stylePreset.text,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        {showImg ? (
          <img
            src={logo}
            alt={symbol}
            width={size}
            height={size}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            style={{
              fontSize: Math.max(9, Math.round(size * 0.32)),
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {cleanSymbol.slice(0, 4)}
          </span>
        )}
      </span>
      {chainBadge && (
        <span
          className="absolute -bottom-1 -right-1 px-1 rounded-full font-bold uppercase"
          style={{
            background: 'var(--card)',
            color: 'var(--foreground)',
            fontSize: 8,
            lineHeight: 1.4,
            border: '1px solid var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        >
          {chainBadge.slice(0, 4)}
        </span>
      )}
    </span>
  )
}
