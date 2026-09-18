import type { Portfolio } from './sync'

/**
 * Demo mode (?demo=1): mock card address + rich portfolio so UI can be
 * reviewed and screenshotted without NFC hardware. Signing stays disabled.
 */
export const DEMO_ADDRESS = '0x8ba1f109551bD432803012645Ac136ddd64DBA72' as `0x${string}`

const E = (n: number, d: number) => BigInt(Math.round(n * 10 ** d))

export const DEMO_PORTFOLIO: Portfolio = {
  tokens: [
    { contractAddress: 'native', symbol: 'ETH', name: 'Ethereum', decimals: 18, balance: E(1.2543, 18), chainId: 1, priceUsd: 3240.5 },
    { contractAddress: 'native', symbol: 'ETH', name: 'Ethereum', decimals: 18, balance: E(0.42, 18), chainId: 8453, priceUsd: 3240.5 },
    { contractAddress: '0x833589fCD6eDb6E08f4c7C32D4fD71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: E(245.1, 6), chainId: 8453, priceUsd: 1 },
    { contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c335', symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: E(80.0, 6), chainId: 137, priceUsd: 1 },
    { contractAddress: '0x912CE59144191C1204E61A17aC361f0319625', symbol: 'ARB', name: 'Arbitrum', decimals: 18, balance: E(120.5, 18), chainId: 42161, priceUsd: 1.82 },
    { contractAddress: '0x4200000000000000000000000000000000000042', symbol: 'OP', name: 'Optimism', decimals: 18, balance: E(45.0, 18), chainId: 10, priceUsd: 2.41 },
    { contractAddress: 'native', symbol: 'POL', name: 'Polygon', decimals: 18, balance: E(300.0, 18), chainId: 137, priceUsd: 0.92 },
    { contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18, balance: E(0.42, 18), chainId: 1, priceUsd: 12.4 },
  ],
  nfts: [
    { contract: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13', tokenId: '8812', chainId: 1, name: 'Bored Ape #8812', collection: 'BAYC', tokenType: 'ERC721' },
    { contract: '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E24', tokenId: '417', chainId: 8453, name: 'Basepaint #417', collection: 'Basepaint', tokenType: 'ERC1155' },
    { contract: '0x00000000000000000000000000000000DEAD00', tokenId: '1', chainId: 1, name: 'CLAIM FREE $BURN', collection: 'Free Mint.xyz', tokenType: 'ERC721', isSpam: true },
  ],
  activity: [
    { hash: '0xaaa111aaa111aaa111aaa111aaa111aaa111aaa111aaa111aaa111aaa111aaaa', chainId: 8453, from: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', value: '0.1', asset: 'ETH', category: 'external', timestamp: new Date(Date.now() - 8 * 60e3).toISOString(), status: 'confirmed' },
    { hash: '0xbbb222bbb222bbb222bbb222bbb222bbb222bbb222bbb222bbb222bbb222bbbb', chainId: 1, from: '0x55a5a5b5B5b5b5b5b5b5B5B5BB5b5B5b5B5B5B5', to: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', value: '245.1', asset: 'USDC', category: 'erc20', timestamp: new Date(Date.now() - 2 * 3600e3).toISOString(), status: 'confirmed' },
    { hash: '0xccc333ccc333ccc333ccc333ccc333ccc333ccc333ccc333ccc333ccc333cccc', chainId: 42161, from: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', to: '0x1111111111111111111111111111111111111111', value: '50', asset: 'ARB', category: 'erc20', timestamp: new Date(Date.now() - 26 * 3600e3).toISOString(), status: 'confirmed' },
    { hash: '0xddd444ddd444ddd444ddd444ddd444ddd444ddd444ddd444ddd444ddd444dddd', chainId: 10, from: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', to: '0x2222222222222222222222222222222222222222', value: '10', asset: 'OP', category: 'erc20', timestamp: new Date(Date.now() - 3 * 86400e3).toISOString(), status: 'confirmed' },
    { hash: '0xeee555eee555eee555eee555eee555eee555eee555eee555eee555eee555eeee', chainId: 137, from: '0x3333333333333333333333333333333333333333', to: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', value: '300', asset: 'POL', category: 'external', timestamp: new Date(Date.now() - 6 * 86400e3).toISOString(), status: 'confirmed' },
  ],
  prices: { ETH: 3240.5, USDC: 1, ARB: 1.82, OP: 2.41, POL: 0.92, UNI: 12.4 },
}

export function isDemoMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('demo')
  )
}
