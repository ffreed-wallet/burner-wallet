import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLibBurner } from '@/providers/LibBurnerProvider';
import { useChain } from '@/providers/ChainProvider';
import { getCoinGeckoIdByAddress, getTokenDetails } from '@/lib/coingecko';
import { Plus } from 'lucide-react';

interface AddTokenModalProps {
  onTokenAdded?: (token: any) => void;
}

export default function AddTokenModal({ onTokenAdded }: AddTokenModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tokenAddress, setTokenAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);

  const { getTokenMetadata } = useLibBurner();
  const { selectedChain, getRpcUrl } = useChain();

  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const fetchTokenInfo = async () => {
    if (!validateAddress(tokenAddress)) {
      setError('Invalid token address format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, try to get CoinGecko ID for the token
      const coinGeckoId = await getCoinGeckoIdByAddress(tokenAddress, selectedChain.chainId);
      
      // Fetch token metadata using RPC
      const tokens = await getTokenMetadata([tokenAddress]);
      
      if (tokens.length > 0) {
        const token = tokens[0];
        
        // Get CoinGecko details if available
        let coinGeckoDetails = null;
        if (coinGeckoId) {
          try {
            coinGeckoDetails = await getTokenDetails(coinGeckoId);
          } catch (err) {
            console.warn('Failed to fetch CoinGecko details:', err);
          }
        }
        
        setTokenInfo({
          address: token.address,
          symbol: token.symbol, // From RPC
          name: token.name, // From RPC
          decimals: token.decimals, // From RPC
          balance: BigInt(0), // No balance needed for metadata
          coinGeckoId: coinGeckoId,
          logoUrl: coinGeckoDetails?.image || coinGeckoDetails?.large || coinGeckoDetails?.small || coinGeckoDetails?.thumb || '',
          price: coinGeckoDetails?.current_price || 0
        });
      } else {
        // If no tokens returned, try to fetch basic token info directly
        try {
          const { createPublicClient, http } = await import('viem');
          const { mainnet, base, polygon, bsc, optimism } = await import('viem/chains');
          
          // Get the appropriate chain for viem
          const getChainForViem = () => {
            switch (selectedChain.chainId) {
              case '0x1': return mainnet;
              case '0x2105': return base;
              case '0x89': return polygon;
              case '0x38': return bsc;
              case '0xa': return optimism;
              default: return base;
            }
          };

          const chain = getChainForViem();
          const publicClient = createPublicClient({
            chain,
            transport: http(getRpcUrl())
          });

          // ERC-20 token info ABI
          const tokenInfoAbi = [
            {
              name: 'decimals',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ name: '', type: 'uint8' }]
            },
            {
              name: 'symbol',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ name: '', type: 'string' }]
            },
            {
              name: 'name',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ name: '', type: 'string' }]
            }
          ];

          const [decimals, symbol, name] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: tokenInfoAbi,
              functionName: 'decimals',
            }),
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: tokenInfoAbi,
              functionName: 'symbol',
            }),
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: tokenInfoAbi,
              functionName: 'name',
            })
          ]);

          // Get CoinGecko details if available
          let coinGeckoDetails = null;
          if (coinGeckoId) {
            try {
              coinGeckoDetails = await getTokenDetails(coinGeckoId);
            } catch (err) {
              console.warn('Failed to fetch CoinGecko details:', err);
            }
          }

          setTokenInfo({
            address: tokenAddress,
            symbol: symbol as string, // From RPC
            name: name as string, // From RPC
            decimals: decimals as number, // From RPC
            balance: BigInt(0),
            coinGeckoId: coinGeckoId,
            logoUrl: coinGeckoDetails?.image || coinGeckoDetails?.large || coinGeckoDetails?.small || coinGeckoDetails?.thumb || '',
            price: coinGeckoDetails?.current_price || 0
          });
        } catch (directErr) {
          setError('Token not found or invalid contract address');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToken = () => {
    if (tokenInfo && onTokenAdded) {
      onTokenAdded(tokenInfo);
      setIsOpen(false);
      setTokenAddress('');
      setTokenInfo(null);
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Token</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tokenAddress">Token Contract Address</Label>
            <Input
              id="tokenAddress"
              placeholder="0x..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter the contract address of the token you want to add
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {tokenInfo && (
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium">Token Information</h4>
              <div className="flex items-start gap-3">
                {tokenInfo.logoUrl && (
                  <img 
                    src={tokenInfo.logoUrl} 
                    alt={tokenInfo.symbol}
                    className="w-12 h-12 rounded-full border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="space-y-1 text-sm flex-1">
                  <div><strong>Name:</strong> {tokenInfo.name} <span className="text-xs text-green-600">(from RPC)</span></div>
                  <div><strong>Symbol:</strong> {tokenInfo.symbol} <span className="text-xs text-green-600">(from RPC)</span></div>
                  <div><strong>Decimals:</strong> {tokenInfo.decimals} <span className="text-xs text-green-600">(from RPC)</span></div>
                  <div><strong>Address:</strong> <span className="font-mono text-xs">{tokenInfo.address}</span></div>
                  <div><strong>Balance:</strong> {tokenInfo.balance.toString() === '0' ? '0 (Zero balance)' : tokenInfo.balance.toString()}</div>
                  {tokenInfo.price > 0 && (
                    <div><strong>Price:</strong> ${tokenInfo.price.toFixed(6)} <span className="text-xs text-blue-600">(from CoinGecko)</span></div>
                  )}
                  {tokenInfo.coinGeckoId && (
                    <div><strong>CoinGecko ID:</strong> <span className="text-xs text-muted-foreground">{tokenInfo.coinGeckoId}</span></div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                This token will be added to your token list even with zero balance.
                <br />
                <span className="text-green-600">✓ Token name, symbol, and decimals fetched from blockchain RPC</span>
                {tokenInfo.coinGeckoId && <><br /><span className="text-blue-600">✓ Price and image data fetched from CoinGecko API</span></>}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={fetchTokenInfo}
              disabled={!tokenAddress || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Fetching...' : 'Fetch Token Info'}
            </Button>
            
            {tokenInfo && (
              <Button
                onClick={handleAddToken}
                className="flex-1"
              >
                Add Token
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
