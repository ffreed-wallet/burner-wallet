// Chainlist API service for fetching chain data
export interface ChainlistChain {
  chainId: number;
  name: string;
  shortName: string;
  chain: string;
  network: string;
  networkId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpc: (string | { url: string; [key: string]: any })[];
  faucets: string[];
  infoURL: string;
  explorers?: Array<{
    name: string;
    url: string;
    standard: string;
  }>;
  icon?: string;
  parent?: {
    chain: string;
    type: string;
    bridges?: Array<{
      url: string;
    }>;
  };
}

// Cache for storing chain data
const chainCache = new Map<number, ChainlistChain>();

// Fetch all chains from Chainlist API
export const fetchAllChains = async (): Promise<ChainlistChain[]> => {
  try {
    const response = await fetch('https://chainlist.org/rpcs.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const chains = await response.json();
    return chains;
  } catch (error) {
    console.error('Error fetching chains from Chainlist:', error);
    throw error;
  }
};

// Fetch chain data by chainId
export const fetchChainById = async (chainId: number): Promise<ChainlistChain | null> => {
  // Check cache first
  if (chainCache.has(chainId)) {
    return chainCache.get(chainId)!;
  }

  try {
    const chains = await fetchAllChains();
    const chain = chains.find(c => c.chainId === chainId);
    
    if (chain) {
      // Cache the result
      chainCache.set(chainId, chain);
      return chain;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching chain by ID:', error);
    return null;
  }
};

// Convert Chainlist chain to our internal format
export const convertChainlistToInternal = (chainlistChain: ChainlistChain) => {
  // Get the first available RPC URL
  let rpcUrl = '';
  if (chainlistChain.rpc && chainlistChain.rpc.length > 0) {
    const firstRpc = chainlistChain.rpc[0];
    // Handle both string and object formats
    if (typeof firstRpc === 'string') {
      rpcUrl = firstRpc;
    } else if (firstRpc && typeof firstRpc === 'object' && 'url' in firstRpc) {
      rpcUrl = (firstRpc as any).url;
    }
  }

  // Generate icon URL from chainlist icon property
  let iconUrl = '';
  if (chainlistChain.icon) {
    iconUrl = `https://icons.llamao.fi/icons/chains/rsz_${chainlistChain.icon}.jpg`;
  }

  return {
    chainId: `0x${chainlistChain.chainId.toString(16)}`,
    displayName: chainlistChain.name,
    rpcUrl: rpcUrl,
    iconUrl: iconUrl,
    viemChain: {
      id: chainlistChain.chainId,
      name: chainlistChain.name
    },
    nativeToken: {
      symbol: chainlistChain.nativeCurrency.symbol,
      decimals: chainlistChain.nativeCurrency.decimals,
      name: chainlistChain.nativeCurrency.name
    },
    isTestnet: chainlistChain.network === 'testnet' || 
                chainlistChain.name.toLowerCase().includes('test') ||
                chainlistChain.name.toLowerCase().includes('sepolia') ||
                chainlistChain.name.toLowerCase().includes('goerli') ||
                chainlistChain.name.toLowerCase().includes('mumbai')
  };
};

// Search chains by name or chainId
export const searchChains = async (query: string): Promise<ChainlistChain[]> => {
  try {
    const chains = await fetchAllChains();
    const lowercaseQuery = query.toLowerCase();
    
    return chains.filter(chain => 
      chain.name.toLowerCase().includes(lowercaseQuery) ||
      chain.chainId.toString().includes(query) ||
      chain.nativeCurrency.symbol.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 20); // Limit to 20 results
  } catch (error) {
    console.error('Error searching chains:', error);
    return [];
  }
};

// Clear cache
export const clearChainlistCache = () => {
  chainCache.clear();
};
