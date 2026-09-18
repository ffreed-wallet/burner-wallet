import { getSdkError } from '@walletconnect/utils'
import type { WcNamespaces, WcProposal } from './client'

/** `eip155:1` / `1` / `eip155:0x1` → numeric chain id, or null. */
export function parseNamespaceChain(ref: string): number | null {
  const tail = ref.includes(':') ? ref.split(':').pop()! : ref
  const n = tail.startsWith('0x') ? Number.parseInt(tail, 16) : Number(tail)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Build the approved `eip155` namespaces for a session proposal.
 *
 * - Unions required + optional eip155 chains, intersected with the ids the
 *   wallet actually supports (allChains(true)).
 * - `accounts` are `eip155:<id>:<address>` for every approved chain.
 * - `methods`/`events` are the union of everything the dApp requested.
 *
 * Throws the `UNSUPPORTED_CHAINS` sdk error when there is zero overlap so
 * the caller can reject the proposal with it.
 */
export function buildApproval(
  proposal: WcProposal,
  address: `0x${string}`,
  supportedChainIds: number[],
): WcNamespaces {
  const supported = new Set(supportedChainIds)
  const chains = new Set<number>()
  const methods = new Set<string>()
  const events = new Set<string>()

  for (const ns of [proposal.requiredNamespaces, proposal.optionalNamespaces]) {
    const eip155 = ns?.['eip155']
    if (!eip155) continue
    for (const c of eip155.chains ?? []) {
      const id = parseNamespaceChain(c)
      if (id != null && supported.has(id)) chains.add(id)
    }
    for (const m of eip155.methods ?? []) methods.add(m)
    for (const e of eip155.events ?? []) events.add(e)
  }

  if (chains.size === 0) throw getSdkError('UNSUPPORTED_CHAINS')
  const ids = [...chains].sort((a, b) => a - b)
  return {
    eip155: {
      chains: ids.map((id) => `eip155:${id}`),
      accounts: ids.map((id) => `eip155:${id}:${address}`),
      methods: [...methods],
      events: [...events],
    },
  }
}

/** Human-readable `chains × methods` summary for the approval sheet. */
export function describeProposal(
  proposal: WcProposal,
  supportedChainIds: number[],
): { chains: number[]; unsupported: number[]; methods: string[] } {
  const supported = new Set(supportedChainIds)
  const requested = new Set<number>()
  const methods = new Set<string>()
  for (const ns of [proposal.requiredNamespaces, proposal.optionalNamespaces]) {
    const eip155 = ns?.['eip155']
    if (!eip155) continue
    for (const c of eip155.chains ?? []) {
      const id = parseNamespaceChain(c)
      if (id != null) requested.add(id)
    }
    for (const m of eip155.methods ?? []) methods.add(m)
  }
  const all = [...requested].sort((a, b) => a - b)
  return {
    chains: all.filter((id) => supported.has(id)),
    unsupported: all.filter((id) => !supported.has(id)),
    methods: [...methods],
  }
}
