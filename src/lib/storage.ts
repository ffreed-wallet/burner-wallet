// Browser storage service for persisting token details and addresses
export interface StoredToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: string;
  coinGeckoId?: string;
  logoUrl?: string;
  addedAt: number;
}

const STORAGE_KEYS = {
  CUSTOM_TOKENS: 'wallet_custom_tokens',
  TOKEN_DETAILS: 'wallet_token_details',
  CUSTOM_CHAINS: 'wallet_custom_chains',
  TESTNET_TOGGLE: 'wallet_testnet_toggle',
  SELECTED_CHAIN: 'wallet_selected_chain'
};

// Get stored custom tokens for a specific chain
export const getStoredTokens = (chainId: string): StoredToken[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_TOKENS);
    if (!stored) return [];
    
    const allTokens: StoredToken[] = JSON.parse(stored);
    return allTokens.filter(token => token.chainId === chainId);
  } catch (error) {
    console.error('Error reading stored tokens:', error);
    return [];
  }
};

// Save a custom token
export const saveToken = (token: Omit<StoredToken, 'addedAt'>): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_TOKENS);
    const allTokens: StoredToken[] = stored ? JSON.parse(stored) : [];
    
    // Check if token already exists
    const existingIndex = allTokens.findIndex(
      t => t.address.toLowerCase() === token.address.toLowerCase() && t.chainId === token.chainId
    );
    
    const tokenWithTimestamp: StoredToken = {
      ...token,
      addedAt: Date.now()
    };
    
    if (existingIndex >= 0) {
      allTokens[existingIndex] = tokenWithTimestamp;
    } else {
      allTokens.push(tokenWithTimestamp);
    }
    
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TOKENS, JSON.stringify(allTokens));
  } catch (error) {
    console.error('Error saving token:', error);
  }
};

// Remove a custom token
export const removeToken = (address: string, chainId: string): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_TOKENS);
    if (!stored) return;
    
    const allTokens: StoredToken[] = JSON.parse(stored);
    const filteredTokens = allTokens.filter(
      token => !(token.address.toLowerCase() === address.toLowerCase() && token.chainId === chainId)
    );
    
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TOKENS, JSON.stringify(filteredTokens));
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

// Get all stored tokens across all chains
export const getAllStoredTokens = (): StoredToken[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_TOKENS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading all stored tokens:', error);
    return [];
  }
};

// Clear all stored tokens
export const clearAllTokens = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_TOKENS);
  } catch (error) {
    console.error('Error clearing all tokens:', error);
  }
};

// Get token details cache
export const getTokenDetailsCache = (): { [key: string]: any } => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TOKEN_DETAILS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading token details cache:', error);
    return {};
  }
};

// Save token details cache
export const saveTokenDetailsCache = (details: { [key: string]: any }): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.TOKEN_DETAILS, JSON.stringify(details));
  } catch (error) {
    console.error('Error saving token details cache:', error);
  }
};

// Update token details in cache
export const updateTokenDetails = (address: string, chainId: string, details: Partial<StoredToken>): void => {
  try {
    const cache = getTokenDetailsCache();
    const key = `${chainId}_${address.toLowerCase()}`;
    
    cache[key] = {
      ...cache[key],
      ...details,
      lastUpdated: Date.now()
    };
    
    saveTokenDetailsCache(cache);
  } catch (error) {
    console.error('Error updating token details:', error);
  }
};

// Get token details from cache
export const getCachedTokenDetails = (address: string, chainId: string): any => {
  try {
    const cache = getTokenDetailsCache();
    const key = `${chainId}_${address.toLowerCase()}`;
    return cache[key] || null;
  } catch (error) {
    console.error('Error getting cached token details:', error);
    return null;
  }
};

// Custom Chain Storage Functions
export interface StoredChain {
  chainId: string;
  displayName: string;
  logo?: string;
  viemChain?: { id: number; name: string };
  rpcUrl?: string;
  nativeToken?: { symbol: string; decimals: number; name: string };
  isTestnet?: boolean;
  addedAt: number;
}

// Get stored custom chains
export const getStoredChains = (): StoredChain[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHAINS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading stored chains:', error);
    return [];
  }
};

// Save a custom chain
export const saveCustomChain = (chain: Omit<StoredChain, 'addedAt'>): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHAINS);
    const allChains: StoredChain[] = stored ? JSON.parse(stored) : [];
    
    // Check if chain already exists
    const existingIndex = allChains.findIndex(
      c => c.chainId.toLowerCase() === chain.chainId.toLowerCase()
    );
    
    const chainWithTimestamp: StoredChain = {
      ...chain,
      addedAt: Date.now()
    };
    
    if (existingIndex >= 0) {
      allChains[existingIndex] = chainWithTimestamp;
    } else {
      allChains.push(chainWithTimestamp);
    }
    
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CHAINS, JSON.stringify(allChains));
  } catch (error) {
    console.error('Error saving custom chain:', error);
  }
};

// Remove a custom chain
export const removeCustomChain = (chainId: string): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHAINS);
    if (!stored) return;
    
    const allChains: StoredChain[] = JSON.parse(stored);
    const filteredChains = allChains.filter(
      chain => chain.chainId.toLowerCase() !== chainId.toLowerCase()
    );
    
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CHAINS, JSON.stringify(filteredChains));
  } catch (error) {
    console.error('Error removing custom chain:', error);
  }
};

// Testnet Toggle Functions
export const getTestnetToggle = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TESTNET_TOGGLE);
    return stored ? JSON.parse(stored) : false;
  } catch (error) {
    console.error('Error reading testnet toggle:', error);
    return false;
  }
};

export const setTestnetToggle = (enabled: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.TESTNET_TOGGLE, JSON.stringify(enabled));
  } catch (error) {
    console.error('Error saving testnet toggle:', error);
  }
};

// Selected Chain Functions
export const getStoredSelectedChain = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_CHAIN);
  } catch (error) {
    console.error('Error reading stored selected chain:', error);
    return null;
  }
};

export const saveSelectedChain = (chainId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_CHAIN, chainId);
  } catch (error) {
    console.error('Error saving selected chain:', error);
  }
};
