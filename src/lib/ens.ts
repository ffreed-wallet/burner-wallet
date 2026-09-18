import { useEffect, useState } from 'react'
import { createPublicClient, http, isAddress } from 'viem'
import { mainnet } from 'viem/chains'

export type EnsResult = { address?: `0x${string}`; error?: string }

export interface EnsProfile {
  name: string | null
  avatar: string | null
}

const PROFILE_CACHE_KEY = 'burner.ensProfiles'

function readProfileCache(): Record<string, EnsProfile> {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeProfileCache(addr: string, profile: EnsProfile): void {
  try {
    const c = readProfileCache()
    c[addr.toLowerCase()] = profile
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(c))
  } catch {
    /* private mode */
  }
}

/** True when the input looks like a name (contains a dot, no 0x prefix). */
export function isEnsName(input: string): boolean {
  const v = input.trim()
  if (!v || v.startsWith('0x') || v.includes(' ')) return false
  return v.includes('.')
}

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum.publicnode.com'),
})

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timed out')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e instanceof Error ? e : new Error(String(e)))
      },
    )
  })
}

/**
 * Reverse-lookup an address → ENS profile (name + avatar) on mainnet.
 * Cached in localStorage; fails soft to {name:null, avatar:null}.
 */
export async function resolveEnsProfile(address: string): Promise<EnsProfile> {
  const key = address.toLowerCase()
  const cached = readProfileCache()[key]
  if (cached) return cached
  const empty: EnsProfile = { name: null, avatar: null }
  try {
    const name = await withTimeout(
      client.getEnsName({ address: address as `0x${string}` }),
      6000,
    )
    if (!name) {
      writeProfileCache(key, empty)
      return empty
    }
    let avatar: string | null = null
    try {
      avatar = await withTimeout(client.getEnsAvatar({ name }), 6000)
    } catch {
      /* avatar optional */
    }
    const profile = { name, avatar }
    writeProfileCache(key, profile)
    return profile
  } catch {
    return empty
  }
}
export async function resolveEns(nameOrAddress: string): Promise<EnsResult> {
  const input = nameOrAddress.trim()
  if (!input) return { error: 'empty' }
  if (isAddress(input)) return { address: input as `0x${string}` }
  if (!isEnsName(input)) return { error: 'not an address' }
  try {
    const addr = await withTimeout(client.getEnsAddress({ name: input }), 6000)
    if (addr && isAddress(addr)) return { address: addr }
    return { error: 'name not found' }
  } catch {
    return { error: 'name not found' }
  }
}

/**
 * React hook: ENS profile for an address (cached, fails soft).
 * Skipped entirely for empty addresses.
 */
export function useEnsProfile(address: string | null | undefined): EnsProfile {
  const [profile, setProfile] = useState<EnsProfile>({ name: null, avatar: null })
  useEffect(() => {
    if (!address || !isAddress(address)) {
      setProfile({ name: null, avatar: null })
      return
    }
    let cancelled = false
    void resolveEnsProfile(address).then((p) => {
      if (!cancelled) setProfile(p)
    })
    return () => {
      cancelled = true
    }
  }, [address])
  return profile
}
