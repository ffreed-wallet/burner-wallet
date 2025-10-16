// CoinGecko API service for fetching token prices and details
export interface CoinGeckoToken {
  id: string;
  symbol: string;
  name: string;
  image: string;
  thumb: string;
  small: string;
  large: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: any;
  last_updated: string;
}

export interface CoinGeckoSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  large: string;
}

// Cache for storing token data
const tokenCache = new Map<string, CoinGeckoToken>();
const searchCache = new Map<string, CoinGeckoSearchResult[]>();

// Get CoinGecko ID for a token by contract address
export const getCoinGeckoIdByAddress = async (address: string, chainId: string): Promise<string | null> => {
  try {
    // Map chain IDs to CoinGecko platform IDs
    const platformMap: { [key: string]: string } = {
      '0x1': 'ethereum',
      '0x89': 'polygon-pos',
      '0x38': 'binance-smart-chain',
      '0xa': 'optimistic-ethereum',
      '0x2105': 'base'
    };

    const platform = platformMap[chainId];
    if (!platform) {
      console.warn(`Unsupported chain ID for CoinGecko: ${chainId}`);
      return null;
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address.toLowerCase()}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error fetching CoinGecko ID:', error);
    return null;
  }
};

// Search for tokens by symbol or name
export const searchTokens = async (query: string): Promise<CoinGeckoSearchResult[]> => {
  if (searchCache.has(query)) {
    return searchCache.get(query)!;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error('Failed to search tokens');
    }

    const data = await response.json();
    const results = data.coins || [];
    
    searchCache.set(query, results);
    return results;
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
};

// Get token details by CoinGecko ID
export const getTokenDetails = async (coinGeckoId: string): Promise<CoinGeckoToken | null> => {
  if (tokenCache.has(coinGeckoId)) {
    return tokenCache.get(coinGeckoId)!;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinGeckoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const token: CoinGeckoToken = {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      image: data.image?.large || data.image?.small || '',
      thumb: data.image?.thumb || '',
      small: data.image?.small || '',
      large: data.image?.large || '',
      current_price: data.market_data?.current_price?.usd || 0,
      market_cap: data.market_data?.market_cap?.usd || 0,
      market_cap_rank: data.market_cap_rank || 0,
      fully_diluted_valuation: data.market_data?.fully_diluted_valuation?.usd || 0,
      total_volume: data.market_data?.total_volume?.usd || 0,
      high_24h: data.market_data?.high_24h?.usd || 0,
      low_24h: data.market_data?.low_24h?.usd || 0,
      price_change_24h: data.market_data?.price_change_24h || 0,
      price_change_percentage_24h: data.market_data?.price_change_percentage_24h || 0,
      market_cap_change_24h: data.market_data?.market_cap_change_24h || 0,
      market_cap_change_percentage_24h: data.market_data?.market_cap_change_percentage_24h || 0,
      circulating_supply: data.market_data?.circulating_supply || 0,
      total_supply: data.market_data?.total_supply || 0,
      max_supply: data.market_data?.max_supply || 0,
      ath: data.market_data?.ath?.usd || 0,
      ath_change_percentage: data.market_data?.ath_change_percentage?.usd || 0,
      ath_date: data.market_data?.ath_date?.usd || '',
      atl: data.market_data?.atl?.usd || 0,
      atl_change_percentage: data.market_data?.atl_change_percentage?.usd || 0,
      atl_date: data.market_data?.atl_date?.usd || '',
      roi: data.market_data?.roi || null,
      last_updated: data.market_data?.last_updated || ''
    };

    tokenCache.set(coinGeckoId, token);
    return token;
  } catch (error) {
    console.error('Error fetching token details:', error);
    return null;
  }
};

// Get multiple token details by IDs
export const getMultipleTokenDetails = async (coinGeckoIds: string[]): Promise<CoinGeckoToken[]> => {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinGeckoIds.join(',')}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.map((token: any) => ({
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      image: token.image,
      thumb: token.image,
      small: token.image,
      large: token.image,
      current_price: token.current_price,
      market_cap: token.market_cap,
      market_cap_rank: token.market_cap_rank,
      fully_diluted_valuation: token.fully_diluted_valuation,
      total_volume: token.total_volume,
      high_24h: token.high_24h,
      low_24h: token.low_24h,
      price_change_24h: token.price_change_24h,
      price_change_percentage_24h: token.price_change_percentage_24h,
      market_cap_change_24h: token.market_cap_change_24h,
      market_cap_change_percentage_24h: token.market_cap_change_percentage_24h,
      circulating_supply: token.circulating_supply,
      total_supply: token.total_supply,
      max_supply: token.max_supply,
      ath: token.ath,
      ath_change_percentage: token.ath_change_percentage,
      ath_date: token.ath_date,
      atl: token.atl,
      atl_change_percentage: token.atl_change_percentage,
      atl_date: token.atl_date,
      roi: token.roi,
      last_updated: token.last_updated
    }));
  } catch (error) {
    console.error('Error fetching multiple token details:', error);
    return [];
  }
};

// Clear cache (useful for testing or when you want fresh data)
export const clearCache = () => {
  tokenCache.clear();
  searchCache.clear();
};
