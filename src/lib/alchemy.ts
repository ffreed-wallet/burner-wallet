// Alchemy API service for fetching token balances and metadata
export interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  error?: string;
}

export interface AlchemyTokenBalancesResponse {
  address: string;
  tokenBalances: AlchemyTokenBalance[];
}

export interface AlchemyTokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface AlchemyTokenMetadataResponse {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

// Chain configuration for Alchemy endpoints
const ALCHEMY_ENDPOINTS: { [chainId: string]: string } = {
  // Mainnet chains
  '0x1': 'https://eth-mainnet.g.alchemy.com/v2', // Ethereum Mainnet
  '0x2105': 'https://base-mainnet.g.alchemy.com/v2', // Base
  '0x89': 'https://polygon-mainnet.g.alchemy.com/v2', // Polygon
  '0x38': 'https://bsc-mainnet.g.alchemy.com/v2', // BSC
  '0xa': 'https://opt-mainnet.g.alchemy.com/v2', // Optimism
  
  // Testnet chains
  '0xaa36a7': 'https://eth-sepolia.g.alchemy.com/v2', // Ethereum Sepolia
  '0x5': 'https://eth-goerli.g.alchemy.com/v2', // Ethereum Goerli
  '0x14a33': 'https://base-sepolia.g.alchemy.com/v2', // Base Sepolia
  '0x13881': 'https://polygon-mumbai.g.alchemy.com/v2', // Polygon Mumbai
  '0x61': 'https://bsc-testnet.g.alchemy.com/v2', // BSC Testnet
  '0x1a4': 'https://opt-goerli.g.alchemy.com/v2', // Optimism Goerli
};

// Cache for storing token metadata
const tokenMetadataCache = new Map<string, AlchemyTokenMetadata>();

// Get Alchemy API key from environment variables
const getAlchemyApiKey = (): string => {
  const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_ALCHEMY_API_KEY environment variable is required');
  }
  return apiKey;
};

// Get token balances for a specific address using Alchemy API
export const getTokenBalances = async (
  address: string,
  chainId: string,
  tokenAddresses?: string[]
): Promise<AlchemyTokenBalancesResponse> => {
  const endpoint = ALCHEMY_ENDPOINTS[chainId];
  if (!endpoint) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const apiKey = getAlchemyApiKey();
  const url = `${endpoint}/${apiKey}`;

  // Use "erc20" to get all ERC-20 tokens, or specific token addresses
  const tokenSpec = tokenAddresses && tokenAddresses.length > 0 ? tokenAddresses : "erc20";

  const payload = {
    jsonrpc: "2.0",
    method: "alchemy_getTokenBalances",
    params: [address, tokenSpec],
    id: 1
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Alchemy API error: ${data.error.message}`);
    }

    return data.result;
  } catch (error) {
    console.error('Error fetching token balances from Alchemy:', error);
    throw error;
  }
};

// Get token metadata for a specific token address
export const getTokenMetadata = async (
  tokenAddress: string,
  chainId: string
): Promise<AlchemyTokenMetadataResponse> => {
  const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
  
  if (tokenMetadataCache.has(cacheKey)) {
    return tokenMetadataCache.get(cacheKey)!;
  }

  const endpoint = ALCHEMY_ENDPOINTS[chainId];
  if (!endpoint) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const apiKey = getAlchemyApiKey();
  const url = `${endpoint}/${apiKey}`;

  const payload = {
    jsonrpc: "2.0",
    method: "alchemy_getTokenMetadata",
    params: [tokenAddress],
    id: 1
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Alchemy API error: ${data.error.message}`);
    }

    const metadata: AlchemyTokenMetadataResponse = {
      name: data.result.name || 'Unknown Token',
      symbol: data.result.symbol || 'UNKNOWN',
      decimals: data.result.decimals || 18,
      logo: data.result.logo
    };

    tokenMetadataCache.set(cacheKey, metadata);
    return metadata;
  } catch (error) {
    console.error('Error fetching token metadata from Alchemy:', error);
    throw error;
  }
};

// Get token balances with metadata for a specific address
export const getTokenBalancesWithMetadata = async (
  address: string,
  chainId: string,
  tokenAddresses?: string[]
): Promise<Array<AlchemyTokenBalance & AlchemyTokenMetadata & { balance: bigint }>> => {
  try {
    // Get token balances
    const balancesResponse = await getTokenBalances(address, chainId, tokenAddresses);
    
    // Get metadata for each token in parallel
    const tokensWithMetadata = await Promise.all(
      balancesResponse.tokenBalances.map(async (tokenBalance) => {
        try {
          const metadata = await getTokenMetadata(tokenBalance.contractAddress, chainId);
          
          // Convert hex balance to bigint
          const balance = BigInt(tokenBalance.tokenBalance);
          
          return {
            ...tokenBalance,
            ...metadata,
            balance
          };
        } catch (error) {
          console.error(`Error fetching metadata for token ${tokenBalance.contractAddress}:`, error);
          return {
            ...tokenBalance,
            name: 'Unknown Token',
            symbol: 'UNKNOWN',
            decimals: 18,
            balance: BigInt(tokenBalance.tokenBalance)
          };
        }
      })
    );

    // Filter out tokens with zero balance
    return tokensWithMetadata.filter(token => token.balance > 0n);
  } catch (error) {
    console.error('Error fetching token balances with metadata:', error);
    throw error;
  }
};

// Get RPC URL for a chain ID from chainConfig.ts
const getRpcUrl = (chainId: string): string => {
  // Import chains from chainConfig.ts
  const { chains, testnetChains } = require('@/chainConfig');
  const allChains = [...chains, ...testnetChains];
  
  const chain = allChains.find(c => c.chainId === chainId);
  return chain?.rpcUrl || 'https://mainnet.base.org';
};

// Make RPC call to get native token balance
const getNativeBalanceViaRpc = async (
  address: string,
  rpcUrl: string
): Promise<bigint> => {
  const payload = {
    jsonrpc: "2.0",
    method: "eth_getBalance",
    params: [address, "latest"],
    id: 1
  };

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return BigInt(data.result);
  } catch (error) {
    console.error('Error fetching RPC native balance:', error);
    throw error;
  }
};

// Get native token balance (ETH, MATIC, BNB, etc.)
export const getNativeTokenBalance = async (
  address: string,
  chainId: string
): Promise<bigint> => {
  const endpoint = ALCHEMY_ENDPOINTS[chainId];
  
  // Try Alchemy first if supported
  if (endpoint) {
    try {
      const apiKey = getAlchemyApiKey();
      const url = `${endpoint}/${apiKey}`;

      const payload = {
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Alchemy API error: ${data.error.message}`);
      }

      return BigInt(data.result);
    } catch (error) {
      console.warn('Alchemy failed, falling back to RPC:', error);
      // Fall through to RPC fallback
    }
  }

  // Fallback to RPC for unsupported chains or when Alchemy fails
  const rpcUrl = getRpcUrl(chainId);
  return getNativeBalanceViaRpc(address, rpcUrl);
};

// Clear cache (useful for testing or when you want fresh data)
export const clearAlchemyCache = () => {
  tokenMetadataCache.clear();
};

// Get supported chain IDs
export const getSupportedChainIds = (): string[] => {
  return Object.keys(ALCHEMY_ENDPOINTS);
};

// Check if a chain is supported
export const isChainSupported = (chainId: string): boolean => {
  return chainId in ALCHEMY_ENDPOINTS;
};

// Asset transfer interfaces
export interface AlchemyAssetTransfer {
  blockNum: string;
  uniqueId: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  erc721TokenId: string | null;
  erc1155Metadata: any | null;
  tokenId: string | null;
  asset: string;
  category: string;
  rawContract: {
    value: string;
    address: string | null;
    decimal: string;
  };
}

export interface AlchemyAssetTransfersResponse {
  transfers: AlchemyAssetTransfer[];
  pageKey?: string;
}

// Get asset transfers for a specific address using Alchemy API
export const getAssetTransfers = async (
  address: string,
  chainId: string,
  fromBlock?: string,
  toBlock?: string,
  maxCount?: number,
  excludeZeroValue?: boolean,
  category?: string[]
): Promise<AlchemyAssetTransfersResponse> => {
  const endpoint = ALCHEMY_ENDPOINTS[chainId];
  if (!endpoint) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const apiKey = getAlchemyApiKey();
  const url = `${endpoint}/${apiKey}`;

  // Build params object for alchemy_getAssetTransfers
  // Base and some other networks don't support "internal" transfers
  const getSupportedCategories = (chainId: string) => {
    const baseCategories = ["external", "erc20", "erc721", "erc1155"];
    const fullCategories = ["external", "erc20", "erc721", "erc1155"];
    
    // Networks that don't support internal transfers
    const noInternalSupport = ['0x2105', '0x14a33']; // Base Mainnet, Base Sepolia
    
    return noInternalSupport.includes(chainId) ? baseCategories : fullCategories;
  };

  const params = {
    fromBlock: fromBlock || "0x0",
    toBlock: toBlock || "latest",
    toAddress: address,
    excludeZeroValue: excludeZeroValue !== false,
    category: category || getSupportedCategories(chainId),
    maxCount: maxCount ? `0x${maxCount.toString(16)}` : "0x3e8" // Convert to hex, default to 1000 (0x3e8)
  };

  const payload = {
    jsonrpc: "2.0",
    method: "alchemy_getAssetTransfers",
    params: [params],
    id: 1
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      // Check if it's a category support error
      if (data.error.message && data.error.message.includes('does not support these requested categories')) {
        console.warn('Category not supported, retrying without internal category:', data.error.message);
        
        // Extract the unsupported category from the error message
        const unsupportedCategoryMatch = data.error.message.match(/\["([^"]+)"\]/);
        if (unsupportedCategoryMatch) {
          const unsupportedCategory = unsupportedCategoryMatch[1];
          const retryParams = {
            ...params,
            category: params.category.filter(cat => cat !== unsupportedCategory)
          };
          
          const retryPayload = {
            jsonrpc: "2.0",
            method: "alchemy_getAssetTransfers",
            params: [retryParams],
            id: 1
          };
          
          console.log('Retrying with categories:', retryParams.category);
          
          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryPayload)
          });
          
          if (!retryResponse.ok) {
            throw new Error(`Alchemy API error: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          
          const retryData = await retryResponse.json();
          
          if (retryData.error) {
            throw new Error(`Alchemy API error: ${retryData.error.message}`);
          }
          
          return retryData.result;
        }
      }
      
      throw new Error(`Alchemy API error: ${data.error.message}`);
    }

    return data.result;
  } catch (error) {
    console.error('Error fetching asset transfers from Alchemy:', error);
    throw error;
  }
};
