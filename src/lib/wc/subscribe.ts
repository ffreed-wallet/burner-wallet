import type { StoreApi } from 'zustand'
import { getWcClient, isWcConfigured } from './client'
import type { WalletState } from '../../store'

/**
 * Wire WalletConnect session events into the zustand store.
 *
 * App.tsx wiring (owner-owned file) — add this snippet (under 25 lines):
 *
 * ```tsx
 * import { useEffect } from 'react'
 * import { subscribeWc } from './lib/wc/subscribe'
 * import { WcProposalSheet, WcRequestSheet } from './components/WcSheets'
 * import { useWallet } from './store'
 *
 * // inside the App component, before return:
 * useEffect(() => subscribeWc(useWallet), [])
 *
 * // inside the returned JSX (next to <ScanSheet/>):
 * <WcProposalSheet />
 * <WcRequestSheet />
 * ```
 *
 * Sheets are self-contained: approval calls `client.approve`, signing
 * success calls `client.respond` with the hash/signature, and every reject
 * path calls `client.respond` (requests) or `client.reject` (proposals)
 * with the matching JSON-RPC / sdk error.
 */
export function subscribeWc(storeApi: StoreApi<WalletState>): () => void {
  if (!isWcConfigured()) return () => {}
  let disposed = false
  const cleanups: (() => void)[] = []

  void getWcClient()
    .then((wcClient) => {
      if (disposed) return
      const api = () => storeApi.getState()

      const refreshSessions = () => {
        try {
          api().setSessions(wcClient.session.values)
        } catch {
          /* session store unavailable */
        }
      }
      refreshSessions()

      const onProposal = (e: {
        id: number
        params: Parameters<WalletState['setProposal']>[0]
      }) => {
        api().setProposal(e.params)
      }
      const onRequest = (e: {
        id: number
        topic: string
        params: { request: { method: string; params: unknown }; chainId: string }
      }) => {
        let dapp = { name: 'Unknown dApp', url: '', icon: undefined as string | undefined }
        try {
          const meta = wcClient.session.get(e.topic).peer.metadata
          dapp = { name: meta.name, url: meta.url, icon: meta.icons?.[0] }
        } catch {
          /* unknown session — still surface the request */
        }
        api().enqueueReq({
          id: e.id,
          topic: e.topic,
          method: e.params.request.method,
          params: e.params.request.params,
          chainId: e.params.chainId,
          dapp,
        })
      }
      const onDelete = (e: { topic: string }) => {
        refreshSessions()
        if (api().pendingReq?.topic === e.topic) api().clearReq()
      }
      const onExpire = (e: { topic: string }) => {
        refreshSessions()
        if (api().pendingReq?.topic === e.topic) api().clearReq()
      }

      wcClient.on('session_proposal', onProposal)
      wcClient.on('session_request', onRequest)
      wcClient.on('session_delete', onDelete)
      wcClient.on('session_expire', onExpire)
      cleanups.push(() => {
        wcClient.off('session_proposal', onProposal)
        wcClient.off('session_request', onRequest)
        wcClient.off('session_delete', onDelete)
        wcClient.off('session_expire', onExpire)
      })
    })
    .catch(() => {
      /* fail closed — key missing; MORE shows "dApps off" */
    })

  return () => {
    disposed = true
    for (const fn of cleanups) fn()
  }
}

/** Refresh the session list in the store (call after approve/disconnect). */
export async function refreshWcSessions(storeApi: StoreApi<WalletState>): Promise<void> {
  try {
    const wcClient = await getWcClient()
    storeApi.getState().setSessions(wcClient.session.values)
  } catch {
    /* fail closed */
  }
}
