/**
 * Burner card session — strict card-only signer.
 * Keys never leave the secure element. The app only ever holds the address
 * plus signatures obtained via NFC tap.
 *
 * Uses the high-level @arx-research/libburner `Burner` class over
 * @arx-research/libhalo `/api/web` (execHaloCmdWeb). The returned viem
 * account signs digests on-card, so the same account object works for every
 * EVM chain (chainId is part of the signed digest).
 */
import type { Account } from 'viem'

export interface BurnerSession {
  address: `0x${string}`
}

export function isNfcSupported(): boolean {
  return getNfcStatus().ok
}

export interface NfcStatus {
  /** Card tap is possible on this device/browser. */
  ok: boolean
  /**
   * Transport libhalo will use (mirrors its internal detectMethod):
   * - `webnfc` on Android Chrome/Edge/Opera/Samsung Internet
   * - `credential` everywhere else capable (iPhone via the iOS system
   *   NFC/passkey sheet — same mechanism burner.pro uses)
   */
  method: 'webnfc' | 'credential' | null
  isIOS: boolean
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Mirrors libhalo's own method detection (`drivers/web.js#detectMethod`):
 * NDEFReader → `webnfc`, otherwise WebAuthn `credential` (the iPhone path —
 * iOS pops its native NFC sheet and the HaLo chip answers as a FIDO
 * authenticator). Desktop browsers have neither NFC hardware nor an NFC
 * credential sheet, so they report unsupported instead of a dead button.
 */
export function getNfcStatus(): NfcStatus {
  const isIOS = detectIOS()
  if (typeof window !== 'undefined' && 'NDEFReader' in window) {
    return { ok: true, method: 'webnfc', isIOS }
  }
  const credOk =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.credentials?.get
  // Credential-method needs OS NFC hardware: iPhones/iPads (and NFC
  // Androids outside Chrome). Desktops report unsupported.
  const mobile =
    isIOS ||
    /Android/.test(navigator.userAgent || '') ||
    (navigator.maxTouchPoints > 0 && /Mobile/.test(navigator.userAgent || ''))
  if (credOk && mobile) {
    return { ok: true, method: 'credential', isIOS }
  }
  return { ok: false, method: null, isIOS }
}

const SAVED_KEY = 'burner.cardAddress'

/**
 * Persisted card address (public info, like the old ff freed-wallet app).
 * Lets balances load without re-tapping; signing ALWAYS needs the card.
 */
export function loadSavedAddress(): `0x${string}` | null {
  try {
    const v = localStorage.getItem(SAVED_KEY)
    return v && v.startsWith('0x') ? (v as `0x${string}`) : null
  } catch {
    return null
  }
}

function saveAddress(address: string): void {
  try {
    localStorage.setItem(SAVED_KEY, address)
  } catch {
    /* private mode */
  }
}

export function clearSavedAddress(): void {
  try {
    localStorage.removeItem(SAVED_KEY)
  } catch {
    /* noop */
  }
}

interface BurnerHandle {
  dispose: () => void
}

// Singleton: one haloExecCb wiring for the whole app session.
let handle: BurnerHandle | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let burnerObj: any = null
let cardAccount: Account | null = null

/** Viem account bound to the tapped card (digest signing happens on-card). */
export function getCardAccount(): Account | null {
  return cardAccount
}

export function clearCardAccount(): void {
  cardAccount = null
}

async function getBurner() {
  if (burnerObj) return burnerObj
  const [{ default: Burner }, { execHaloCmdWeb }] = await Promise.all([
    import('@arx-research/libburner'),
    import('@arx-research/libhalo/api/web'),
  ])
  burnerObj = new Burner({
    haloExecCb: (cmd: unknown) => execHaloCmdWeb(cmd as never),
    chainRpcUrls: { http: ['https://mainnet.base.org/'] },
  })
  handle = {
    dispose: () => {
      burnerObj = null
      handle = null
    },
  }
  void handle
  return burnerObj
}

/**
 * Scan the Burner ETH card and return the session address.
 *
 * Per libburner docs this is a PUBLIC read (`get_data_struct` carries no
 * password): no PIN is involved here. The PIN only matters at SIGN time
 * (see signWithPinRetry). Every scan forces a fresh NFC tap — the Burner
 * object caches tag data after the first read, and reusing it would report
 * a stale (possibly different) card without touching the reader.
 */
export async function scanBurnerCard(): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BurnerSession & { account: Account; raw: any }
> {
  if (!isNfcSupported()) {
    throw new Error(
      'NFC is not available. Open this app in Chrome on Android (or Safari on iPhone with NFC) over HTTPS.',
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const burner: any = await getBurner()
  // Drop cached tag data so this scan taps the card that's actually present.
  burner.burnerData = null
  ensurePinFresh()
  const data = await burner.getData()
  cardAccount = burner.asViemAccount() as Account
  saveAddress(data.address)
  return {
    address: data.address as `0x${string}`,
    account: cardAccount,
    raw: data,
  }
}

/** Short `0x1234…abcd` form used across the monospace UI. */
export function shortAddress(address: string): string {
  if (address.length <= 10) return address.replace(/^0X/, '0x')
  const head =
    /^0[xX]/.test(address) ? `0x${address.slice(2, 6)}` : address.slice(0, 6)
  return `${head}…${address.slice(-4)}`
}

// ---- Card PIN (sign-time only) -----------------------------------------
// Per libburner, the password is consumed exclusively by the `sign`
// command. libhalo reports tag-side failures as HaloTagError whose `name`
// is the exact code:
//   ERROR_CODE_PWD_NOT_SET   — PIN-gated slot, no password given
//   ERROR_CODE_WRONG_PWD     — wrong password
//   ERROR_CODE_TOO_MANY_AUTH_FAILS / AUTH_SOFT_LOCKED / AUTH_HW_LOCKED — locked
// The PIN lives in memory only (never localStorage) and expires after
// `pinCacheSeconds` (Settings → Security, default 60, 0 = ask every time).

const PIN_SETTINGS_KEY = 'burner.settings'

interface PinCache {
  pin: string
  expiresAt: number
}

let pinCache: PinCache | null = null

function readPinTtl(): number {
  try {
    const s = JSON.parse(
      localStorage.getItem(PIN_SETTINGS_KEY) ?? '{}',
    ) as { pinCacheSeconds?: unknown }
    if (s.pinCacheSeconds == null) return 60
    return typeof s.pinCacheSeconds === 'number' && s.pinCacheSeconds > 0
      ? s.pinCacheSeconds
      : 0
  } catch {
    return 60
  }
}

/** Human TTL for PIN memory, e.g. "1 min" / "5 min" / "off". */
export function pinTtlLabel(): string {
  const ttl = readPinTtl()
  if (ttl <= 0) return 'off'
  if (ttl < 60) return `${ttl}s`
  const m = Math.round(ttl / 60)
  return m === 1 ? '1 min' : `${m} min`
}

/** Drop an expired PIN (and the password on the card handle with it). */
export function ensurePinFresh(): void {
  if (pinCache && Date.now() > pinCache.expiresAt) {
    pinCache = null
    if (burnerObj) burnerObj.keyPassword = null
  }
}

function getCachedPin(): string | null {
  ensurePinFresh()
  return pinCache?.pin ?? null
}

export function hasCardPassword(): boolean {
  return burnerObj?.keyPassword != null
}

/** Stash the PIN on the card handle (+ in-memory cache when TTL > 0). */
export async function setCardPassword(pin: string): Promise<void> {
  const burner = await getBurner()
  // Direct field write: setPassword() throws without tag data, but the
  // password is only read at sign time, so this is equivalent and total.
  burner.keyPassword = pin
  burner.rawPwdDigest = null
  const ttl = readPinTtl()
  pinCache = ttl > 0 ? { pin, expiresAt: Date.now() + ttl * 1000 } : null
}

/** Forget the PIN everywhere (failed attempt, lock, user cancel). */
export function clearCardPassword(): void {
  pinCache = null
  if (burnerObj) burnerObj.keyPassword = null
}

type CardErrorKind = 'pin-needed' | 'wrong-pin' | 'locked' | 'other'

const PIN_NEEDED_RE = /PWD_NOT_SET|PWD_MANDATORY|password was not set|must be password protected/i
const WRONG_PIN_RE = /WRONG_PWD|wrong password/i
const LOCKED_RE = /TOO_MANY_AUTH_FAILS|AUTH_SOFT_LOCKED|AUTH_HW_LOCKED|permanently locked|soft-locked|hw-locked/i

function errorText(e: unknown, depth = 0): string {
  if (depth > 3 || e == null) return ''
  if (typeof e === 'string') return e
  if (e instanceof Error) {
    const cause = (e as { cause?: unknown }).cause
    return `${e.name} ${e.message} ${errorText(cause, depth + 1)}`
  }
  return ''
}

/** Classify a signing failure (walks viem `cause` chains). */
export function classifyCardError(e: unknown): CardErrorKind {
  const t = errorText(e)
  if (LOCKED_RE.test(t)) return 'locked'
  if (WRONG_PIN_RE.test(t)) return 'wrong-pin'
  if (PIN_NEEDED_RE.test(t)) return 'pin-needed'
  return 'other'
}

/** Card-aware error text for signing sheets (passes anything else through). */
export function friendlyCardError(e: unknown): string {
  const kind = classifyCardError(e)
  if (kind === 'locked') {
    return 'CARD LOCKED — too many wrong PINs. The card enforces this permanently.'
  }
  if (kind === 'wrong-pin') {
    return 'INCORRECT PIN — check and retry. The card locks after repeated failures.'
  }
  if (kind === 'pin-needed') {
    return 'CARD PIN REQUIRED — enter it to continue.'
  }
  return e instanceof Error ? e.message : 'Signing failed.'
}

/**
 * Run a card signing operation, prompting for the PIN (via `prompt`) when
 * the slot demands it. Applies a remembered PIN proactively, retries once
 * with a freshly entered one, and never swallows non-PIN errors.
 * `prompt` resolves the entered PIN or null when the user cancels.
 */
export async function signWithPinRetry<T>(
  op: () => Promise<T>,
  prompt: (reason: 'needed' | 'wrong') => Promise<string | null>,
): Promise<T> {
  try {
    const cached = getCachedPin()
    if (cached && !hasCardPassword()) {
      const burner = await getBurner()
      burner.keyPassword = cached
      burner.rawPwdDigest = null
    }
    return await op()
  } catch (e) {
    const kind = classifyCardError(e)
    if (kind === 'locked') {
      clearCardPassword()
      throw new Error(friendlyCardError(e))
    }
    if (kind !== 'pin-needed' && kind !== 'wrong-pin') throw e
    clearCardPassword()
    const pin = await prompt(kind === 'wrong-pin' ? 'wrong' : 'needed')
    if (!pin) throw e
    await setCardPassword(pin)
    try {
      return await op()
    } catch (e2) {
      clearCardPassword()
      if (classifyCardError(e2) !== 'other') {
        throw new Error(
          'INCORRECT PIN — check and retry. The card locks after repeated failures.',
        )
      }
      throw e2
    }
  } finally {
    // TTL 0 ("ask every time"): never retain the password past this op.
    if (readPinTtl() <= 0) clearCardPassword()
  }
}
