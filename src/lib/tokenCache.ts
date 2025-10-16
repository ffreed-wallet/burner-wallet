interface CachedTokenData {
  tokens: any[];
  timestamp: number;
  chainId: string;
  walletAddress: string;
}

const CACHE_KEY = 'wallet_token_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export const getCachedTokens = (chainId: string, walletAddress: string): any[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedTokenData = JSON.parse(cached);
    
    // Check if cache is for the same chain and wallet
    if (data.chainId !== chainId || data.walletAddress !== walletAddress) {
      return null;
    }
    
    // Check if cache is still valid (within 10 minutes)
    const now = Date.now();
    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return data.tokens;
  } catch (error) {
    console.error('Error reading cached tokens:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

export const setCachedTokens = (tokens: any[], chainId: string, walletAddress: string): void => {
  try {
    const data: CachedTokenData = {
      tokens,
      timestamp: Date.now(),
      chainId,
      walletAddress
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error caching tokens:', error);
  }
};

export const clearTokenCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing token cache:', error);
  }
};

export const getCacheAge = (): number | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedTokenData = JSON.parse(cached);
    return Date.now() - data.timestamp;
  } catch (error) {
    console.error('Error getting cache age:', error);
    return null;
  }
};
