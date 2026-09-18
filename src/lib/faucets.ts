/** Easiest no-cost faucets for card E2E testing (testnets only). */
export interface Faucet {
  name: string
  url: string
  gives: string
  notes: string
}

export const FAUCETS: Faucet[] = [
  {
    name: 'Alchemy Sepolia Faucet',
    url: 'https://www.alchemy.com/faucets/ethereum-sepolia',
    gives: 'Sepolia ETH',
    notes: 'Free Alchemy account, daily claim. Easiest if you already have a key.',
  },
  {
    name: 'Google Cloud Web3 Faucet',
    url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
    gives: 'Sepolia ETH',
    notes: 'Sign in with Google, no mining. Good backup.',
  },
  {
    name: 'Coinbase Base Sepolia Faucet',
    url: 'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
    gives: 'Base Sepolia ETH',
    notes: 'Covers the Base testnet leg of the E2E.',
  },
  {
    name: 'Superbridge (testnet bridge)',
    url: 'https://superbridge.app/base-sepolia',
    gives: 'Bridge Sepolia ETH → Base Sepolia',
    notes: 'Same flow burner.pro docs recommend, on testnets.',
  },
]
