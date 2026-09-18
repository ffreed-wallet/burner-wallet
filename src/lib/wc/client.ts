import SignClient from '@walletconnect/sign-client'

/**
 * Concrete client type inferred from init (avoids the duplicated
 * `@walletconnect/types` copies hoisted vs. nested under sign-client,
 * which are structurally the same but nominally clash via pino Logger).
 */
export type WcClient = Awaited<ReturnType<typeof SignClient.init>>

/**
 * Session / proposal structs from the SAME `@walletconnect/types` copy the
 * client was built against (the hoisted top-level copy differs slightly,
 * e.g. CacaoPayload.aud, so every file uses these aliases).
 */
export type WcSession = ReturnType<WcClient['session']['get']>
export type WcProposal = ReturnType<WcClient['proposal']['get']>
export type WcNamespaces = Parameters<WcClient['approve']>[0]['namespaces']

/** WalletConnect project id from env (cloud.walletconnect.com, free tier). */
export function wcProjectId(): string | null {
  const v = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()
  return v ? v : null
}

/** False when no project id is configured — dApp pairing is off. */
export function isWcConfigured(): boolean {
  return wcProjectId() !== null
}

let client: WcClient | null = null
let inflight: Promise<WcClient> | null = null

/**
 * Singleton SignClient. Fail closed: throws a clear error when the
 * project id is missing so callers can show "dApps off" instead of
 * silently failing.
 */
export function getWcClient(): Promise<WcClient> {
  if (client) return Promise.resolve(client)
  if (inflight) return inflight
  const projectId = wcProjectId()
  if (!projectId) {
    return Promise.reject(
      new Error(
        'WALLETCONNECT OFF — set VITE_WALLETCONNECT_PROJECT_ID in .env (free at cloud.walletconnect.com).',
      ),
    )
  }
  inflight = SignClient.init({
    projectId,
    relayUrl: 'wss://relay.walletconnect.com',
    metadata: {
      name: 'Burner Wallet',
      description: 'Companion wallet for burner.pro ETH cards',
      url: location.origin,
      icons: [`${location.origin}/icons/icon-192.png`],
    },
  }).then((c) => {
    client = c
    inflight = null
    return c
  })
  return inflight
}
