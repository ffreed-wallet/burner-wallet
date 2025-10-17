// Simplified chain configuration for UI-only display

export const chains = [
	{
		chainId: '0x1',
		displayName: 'Ethereum',
		logo: '/chain/mainnet/logo.png',
		viemChain: { id: 1, name: 'Ethereum' },
		rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://etherscan.io',
		nativeToken: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
		isTestnet: false
	},
	{
		chainId: '0x2105',
		displayName: 'Base',
		logo: '/chain/base/logo.png',
		viemChain: { id: 8453, name: 'Base' },
		rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://basescan.org',
		nativeToken: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
		isTestnet: false
	},
	{
		chainId: '0x89',
		displayName: 'Polygon',
		logo: '/chain/polygon/logo.png',
		viemChain: { id: 137, name: 'Polygon' },
		rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://polygonscan.com',
		nativeToken: { symbol: 'MATIC', decimals: 18, name: 'Polygon' },
		isTestnet: false
	},
	{
		chainId: '0x38',
		displayName: 'Binance Smart Chain',
		logo: '/chain/bsc/logo.png',
		viemChain: { id: 56, name: 'BSC' },
		rpcUrl: `https://bsc-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://bscscan.com',
		nativeToken: { symbol: 'BNB', decimals: 18, name: 'Binance Coin' },
		isTestnet: false
	},
	{
		chainId: '0xa',
		displayName: 'Optimism',
		logo: '/chain/optimism/logo.png',
		viemChain: { id: 10, name: 'Optimism' },
		rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://optimistic.etherscan.io',
		nativeToken: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
		isTestnet: false
	}
];

// Testnet chains
export const testnetChains = [
	{
		chainId: '0xaa36a7',
		displayName: 'Ethereum Sepolia',
		logo: '/chain/mainnet/logo.png',
		viemChain: { id: 11155111, name: 'Sepolia' },
		rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com/',
		blockExplorerUrl: 'https://sepolia.etherscan.io',
		nativeToken: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
		isTestnet: true
	},
	{
		chainId: '0x5',
		displayName: 'Ethereum Goerli',
		logo: '/chain/mainnet/logo.png',
		viemChain: { id: 5, name: 'Goerli' },
		rpcUrl: `https://eth-goerli.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://goerli.etherscan.io',
		nativeToken: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
		isTestnet: true
	},
	{
		chainId: '0x14a33',
		displayName: 'Base Sepolia',
		logo: '/chain/base/logo.png',
		viemChain: { id: 84532, name: 'Base Sepolia' },
		rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://sepolia.basescan.org',
		nativeToken: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
		isTestnet: true
	},
	{
		chainId: '0x13881',
		displayName: 'Polygon Mumbai',
		logo: '/chain/polygon/logo.png',
		viemChain: { id: 80001, name: 'Mumbai' },
		rpcUrl: `https://polygon-mumbai.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://mumbai.polygonscan.com',
		nativeToken: { symbol: 'MATIC', decimals: 18, name: 'Polygon' },
		isTestnet: true
	},
	{
		chainId: '0x61',
		displayName: 'BSC Testnet',
		logo: '/chain/bsc/logo.png',
		viemChain: { id: 97, name: 'BSC Testnet' },
		rpcUrl: `https://bsc-testnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://testnet.bscscan.com',
		nativeToken: { symbol: 'BNB', decimals: 18, name: 'Binance Coin' },
		isTestnet: true
	},
	{
		chainId: '0x1a4',
		displayName: 'Optimism Goerli',
		logo: '/chain/optimism/logo.png',
		viemChain: { id: 420, name: 'Optimism Goerli' },
		rpcUrl: `https://opt-goerli.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
		blockExplorerUrl: 'https://goerli-optimism.etherscan.io',
		nativeToken: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
		isTestnet: true
	}
];

