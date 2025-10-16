// Comprehensive token lists for each supported chain
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isNative?: boolean;
}

export interface ChainTokens {
  [chainId: string]: TokenInfo[];
}

export const tokenLists: ChainTokens = {
  // Ethereum Mainnet
  '0x1': [],

  // Base
  '0x2105': [],

  // Polygon
  '0x89': [],

  // BSC
  '0x38': [],
  // Optimism
  '0xa': [],
};

// Helper function to get tokens for a specific chain
export const getTokensForChain = (chainId: string): TokenInfo[] => {
  return tokenLists[chainId] || [];
};

// Helper function to get native token for a chain
export const getNativeToken = (chainId: string): TokenInfo | null => {
  const tokens = getTokensForChain(chainId);
  return tokens.find(token => token.isNative) || null;
};

// Helper function to find token by address
export const findTokenByAddress = (chainId: string, address: string): TokenInfo | null => {
  const tokens = getTokensForChain(chainId);
  return tokens.find(token => token.address.toLowerCase() === address.toLowerCase()) || null;
};
