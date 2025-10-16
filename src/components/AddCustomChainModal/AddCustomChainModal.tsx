import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useChain } from '@/providers/ChainProvider';
import { saveCustomChain } from '@/lib/storage';
import { fetchChainById, convertChainlistToInternal, searchChains, ChainlistChain } from '@/lib/chainlist';
import { toast } from 'sonner';
import { Loader2, Search, CheckCircle } from 'lucide-react';

interface AddCustomChainModalProps {
  children: React.ReactNode;
}

export default function AddCustomChainModal({ children }: AddCustomChainModalProps) {
  const { addCustomChain } = useChain();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChainlistChain[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainlistChain | null>(null);
  const [isLoadingChain, setIsLoadingChain] = useState(false);
  const [formData, setFormData] = useState({
    chainId: '',
    displayName: '',
    rpcUrl: '',
    nativeTokenSymbol: 'ETH',
    nativeTokenDecimals: '18',
    nativeTokenName: '',
    iconUrl: '',
    isTestnet: false
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Search chains when query changes
  useEffect(() => {
    const searchChainsDebounced = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchChains(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching chains:', error);
        toast.error('Failed to search chains');
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchChainsDebounced, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Load chain by ID
  const handleLoadChainById = async () => {
    if (!formData.chainId) return;

    setIsLoadingChain(true);
    try {
      // Convert hex to decimal if needed
      let chainIdNum: number;
      if (formData.chainId.startsWith('0x')) {
        chainIdNum = parseInt(formData.chainId, 16);
      } else {
        chainIdNum = parseInt(formData.chainId, 10);
      }

      const chain = await fetchChainById(chainIdNum);
      if (chain) {
        setSelectedChain(chain);
        const converted = convertChainlistToInternal(chain);
        
        setFormData(prev => ({
          ...prev,
          displayName: converted.displayName,
          rpcUrl: converted.rpcUrl,
          nativeTokenSymbol: converted.nativeToken.symbol,
          nativeTokenDecimals: converted.nativeToken.decimals.toString(),
          nativeTokenName: converted.nativeToken.name,
          iconUrl: converted.iconUrl || '',
          isTestnet: converted.isTestnet
        }));
        
        toast.success('Chain data loaded successfully!');
      } else {
        toast.error('Chain not found in Chainlist');
      }
    } catch (error) {
      console.error('Error loading chain:', error);
      toast.error('Failed to load chain data');
    } finally {
      setIsLoadingChain(false);
    }
  };

  // Select chain from search results
  const handleSelectChain = (chain: ChainlistChain) => {
    setSelectedChain(chain);
    const converted = convertChainlistToInternal(chain);
    
    setFormData(prev => ({
      ...prev,
      chainId: converted.chainId,
      displayName: converted.displayName,
      rpcUrl: converted.rpcUrl,
      nativeTokenSymbol: converted.nativeToken.symbol,
      nativeTokenDecimals: converted.nativeToken.decimals.toString(),
      nativeTokenName: converted.nativeToken.name,
      iconUrl: converted.iconUrl || '',
      isTestnet: converted.isTestnet
    }));
    
    setSearchQuery('');
    setSearchResults([]);
    toast.success('Chain selected!');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.chainId || !formData.displayName || !formData.rpcUrl) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate chain ID format (should be hex)
    let chainIdHex = formData.chainId;
    if (!chainIdHex.startsWith('0x')) {
      chainIdHex = '0x' + chainIdHex;
    }

    // Validate chain ID is a valid hex number
    try {
      parseInt(chainIdHex, 16);
    } catch {
      toast.error('Invalid chain ID format');
      return;
    }

    const customChain = {
      chainId: chainIdHex,
      displayName: formData.displayName,
      rpcUrl: formData.rpcUrl,
      logo: formData.iconUrl || undefined,
      viemChain: {
        id: parseInt(chainIdHex, 16),
        name: formData.displayName
      },
      nativeToken: {
        symbol: formData.nativeTokenSymbol,
        decimals: parseInt(formData.nativeTokenDecimals),
        name: formData.nativeTokenName || formData.displayName
      },
      isTestnet: formData.isTestnet
    };

    try {
      // Save to storage
      saveCustomChain(customChain);
      
      // Add to context
      addCustomChain(customChain);
      
      toast.success('Custom chain added successfully!');
      setOpen(false);
      
      // Reset form
      setFormData({
        chainId: '',
        displayName: '',
        rpcUrl: '',
        nativeTokenSymbol: 'ETH',
        nativeTokenDecimals: '18',
        nativeTokenName: '',
        iconUrl: '',
        isTestnet: false
      });
      setSearchQuery('');
      setSearchResults([]);
      setSelectedChain(null);
    } catch (error) {
      toast.error('Failed to add custom chain');
      console.error('Error adding custom chain:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Custom Chain</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chain Search */}
          <div className="space-y-2">
            <Label htmlFor="searchQuery">Search Chains</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="searchQuery"
                placeholder="Search by name, symbol, or chain ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border rounded-md">
                {searchResults.map((chain) => (
                  <div
                    key={chain.chainId}
                    className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer"
                    onClick={() => handleSelectChain(chain)}
                  >
                    <div>
                      <div className="font-medium">{chain.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Chain ID: {chain.chainId} • {chain.nativeCurrency.symbol}
                      </div>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chain ID Input */}
          <div className="space-y-2">
            <Label htmlFor="chainId">Chain ID *</Label>
            <div className="flex gap-2">
              <Input
                id="chainId"
                placeholder="e.g., 1, 137, 8453"
                value={formData.chainId}
                onChange={(e) => handleInputChange('chainId', e.target.value)}
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadChainById}
                disabled={!formData.chainId || isLoadingChain}
              >
                {isLoadingChain ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Load'
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              placeholder="e.g., Ethereum, Polygon"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rpcUrl">RPC URL *</Label>
            <Input
              id="rpcUrl"
              placeholder="https://..."
              value={formData.rpcUrl}
              onChange={(e) => handleInputChange('rpcUrl', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nativeTokenSymbol">Native Token Symbol</Label>
            <Input
              id="nativeTokenSymbol"
              placeholder="ETH"
              value={formData.nativeTokenSymbol}
              onChange={(e) => handleInputChange('nativeTokenSymbol', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nativeTokenDecimals">Native Token Decimals</Label>
            <Input
              id="nativeTokenDecimals"
              type="number"
              placeholder="18"
              value={formData.nativeTokenDecimals}
              onChange={(e) => handleInputChange('nativeTokenDecimals', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nativeTokenName">Native Token Name</Label>
            <Input
              id="nativeTokenName"
              placeholder="Ethereum"
              value={formData.nativeTokenName}
              onChange={(e) => handleInputChange('nativeTokenName', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="iconUrl">Icon URL (Optional)</Label>
            <Input
              id="iconUrl"
              placeholder="https://icons.llamao.fi/icons/chains/rsz_plasma.jpg"
              value={formData.iconUrl}
              onChange={(e) => handleInputChange('iconUrl', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter a URL to an image for the chain icon. Example: https://icons.llamao.fi/icons/chains/rsz_plasma.jpg
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isTestnet"
              checked={formData.isTestnet}
              onCheckedChange={(checked) => handleInputChange('isTestnet', checked)}
            />
            <Label htmlFor="isTestnet">Testnet</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add Chain
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
