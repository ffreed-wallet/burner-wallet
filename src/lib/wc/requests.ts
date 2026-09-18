import { hexToBytes, isHex, toHex } from 'viem'

/** `eip155:11155111` → 11155111, or null for non-eip155 scopes. */
export function parseChainId(chainId: string): number | null {
  if (!chainId.startsWith('eip155:')) return null
  const tail = chainId.split(':')[1] ?? ''
  const n = tail.startsWith('0x') ? Number.parseInt(tail, 16) : Number(tail)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** `0x…` (hex quantity or bytes) → bigint, or null. */
export function hexToBigint(v: unknown): bigint | null {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v)
  if (typeof v === 'string' && isHex(v)) {
    try {
      return BigInt(v)
    } catch {
      return null
    }
  }
  return null
}

/** `0x…` hex quantity → number, or null. */
export function hexToNumber(v: unknown): number | null {
  const b = hexToBigint(v)
  if (b == null) return null
  const n = Number(b)
  return Number.isSafeInteger(n) ? n : null
}

export interface DecodedTx {
  from?: `0x${string}`
  to?: `0x${string}`
  value?: bigint
  data?: `0x${string}`
  gasLimit?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: number
}

/** Decode eth_sendTransaction params[0] into typed fields. */
export function decodeSendTransaction(params: unknown): DecodedTx {
  const raw = (Array.isArray(params) ? params[0] : null) as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object') throw new Error('Missing transaction object.')
  const asAddr = (v: unknown): `0x${string}` | undefined =>
    typeof v === 'string' && v.startsWith('0x') ? (v as `0x${string}`) : undefined
  const asData = (v: unknown): `0x${string}` | undefined =>
    typeof v === 'string' && isHex(v) ? (v as `0x${string}`) : undefined
  const gasLimit = hexToBigint(raw.gas ?? raw.gasLimit)
  return {
    from: asAddr(raw.from),
    to: asAddr(raw.to),
    value: hexToBigint(raw.value) ?? undefined,
    data: asData(raw.data),
    gasLimit: gasLimit ?? undefined,
    gasPrice: hexToBigint(raw.gasPrice) ?? undefined,
    maxFeePerGas: hexToBigint(raw.maxFeePerGas) ?? undefined,
    maxPriorityFeePerGas: hexToBigint(raw.maxPriorityFeePerGas) ?? undefined,
    nonce: hexToNumber(raw.nonce) ?? undefined,
  }
}

export interface DecodedMessage {
  message: `0x${string}` | string
  /** UTF-8 text when the payload decodes to printable text, else null. */
  text: string | null
  address: `0x${string}` | null
  /** True when the payload is opaque bytes — warn before signing. */
  opaque: boolean
}

/** Best-effort hex → UTF-8, printable only (null when binary/opaque). */
export function hexToText(hex: string): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(hexToBytes(hex as `0x${string}`))
    // Printable ASCII + common whitespace only; anything else is "opaque".
    if ([...text].every((ch) => ch === '\n' || ch === '\r' || ch === '\t' || (ch >= ' ' && ch <= '~'))) {
      return text
    }
    return null
  } catch {
    return null
  }
}

function toMessageParam(v: unknown): DecodedMessage {
  if (typeof v === 'string' && isHex(v)) {
    const text = hexToText(v)
    return { message: v as `0x${string}`, text, address: null, opaque: text == null }
  }
  if (typeof v === 'string') {
    return { message: v, text: v, address: null, opaque: false }
  }
  return { message: '', text: null, address: null, opaque: true }
}

const isAddr = (v: unknown): v is `0x${string}` =>
  typeof v === 'string' && v.startsWith('0x') && v.length === 42

/**
 * personal_sign params are `[msg, address]` — but some dApps send them
 * reversed, so detect by shape.
 */
export function decodePersonalSign(params: unknown): DecodedMessage {
  if (!Array.isArray(params) || params.length < 1) throw new Error('Missing sign params.')
  const [a, b] = params as [unknown, unknown]
  if (isAddr(a) && !isAddr(b)) return { ...toMessageParam(b), address: a }
  if (isAddr(b) && !isAddr(a)) return { ...toMessageParam(a), address: b }
  // Neither looks like an address: treat first as the message.
  return { ...toMessageParam(a), address: isAddr(b) ? b : null }
}

/** eth_sign params are `[address, message]`. */
export function decodeEthSign(params: unknown): DecodedMessage {
  if (!Array.isArray(params) || params.length < 2) throw new Error('Missing sign params.')
  const [addr, msg] = params as [unknown, unknown]
  return { ...toMessageParam(msg), address: isAddr(addr) ? addr : null }
}

export interface DecodedTypedData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  domain: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  types: Record<string, any>
  primaryType: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any
  address: `0x${string}` | null
  raw: string
}

/**
 * eth_signTypedData* params are `[address, typedDataJson]`, where the payload
 * is either a JSON string or an already-parsed object.
 */
export function decodeTypedData(params: unknown): DecodedTypedData {
  if (!Array.isArray(params) || params.length < 2) throw new Error('Missing typed-data params.')
  const [addr, payload] = params as [unknown, unknown]
  let obj: Record<string, unknown>
  if (typeof payload === 'string') {
    try {
      obj = JSON.parse(payload) as Record<string, unknown>
    } catch {
      throw new Error('Malformed typed-data JSON.')
    }
  } else if (payload && typeof payload === 'object') {
    obj = payload as Record<string, unknown>
  } else {
    throw new Error('Malformed typed-data payload.')
  }
  const domain = (obj.domain ?? {}) as Record<string, never>
  const types = (obj.types ?? {}) as Record<string, never>
  const primaryType = typeof obj.primaryType === 'string' ? obj.primaryType : '(unknown)'
  return {
    domain,
    types,
    primaryType,
    message: obj.message,
    address: isAddr(addr) ? addr : null,
    raw: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }
}

/** wallet_switchEthereumChain params are `[{ chainId: '0x…' }]`. */
export function decodeSwitchChain(params: unknown): number {
  const raw = (Array.isArray(params) ? params[0] : null) as { chainId?: unknown } | null
  const id = hexToNumber(raw?.chainId)
  if (id == null) throw new Error('Missing chainId.')
  return id
}

/** EIP-191 message bytes for card signing (hex stays hex, text stays text). */
export function messageToSign(msg: DecodedMessage): `0x${string}` | string {
  return msg.message
}

/** dApp chain hex (`0xa4b1`) for the chainChanged event. */
export function toChainHex(chainId: number): `0x${string}` {
  return toHex(chainId)
}
