import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { chains, testnetChains } from '@/chainConfig';
import { getStoredChains, getTestnetToggle, getStoredSelectedChain, saveSelectedChain, StoredChain } from '@/lib/storage';

interface Chain {
  chainId: string; // hex
  displayName: string;
  logo?: string;
  viemChain?: { id: number; name: string };
  rpcUrl?: string;
  blockExplorerUrl?: string;
  nativeToken?: { symbol: string; decimals: number; name: string };
  isTestnet?: boolean;
}

interface ChainContextType {
  selectedChain: Chain;
  setSelectedChain: (chain: Chain) => void;
  getRpcUrl: () => string;
  knownChains: Chain[];
  addCustomChain: (chain: Chain) => void;
  removeCustomChain: (chainId: string) => void;
  isTestnetEnabled: boolean;
  setTestnetEnabled: (enabled: boolean) => void;
  availableChains: Chain[];
  isInitialized: boolean;
}

const ChainContext = createContext<ChainContextType | undefined>(undefined);

export const ChainProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isTestnetEnabled, setIsTestnetEnabled] = useState<boolean>(false);
  const [customChains, setCustomChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState<Chain>(chains[0] as unknown as Chain);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Load settings from storage on mount
  useEffect(() => {
    const storedTestnetToggle = getTestnetToggle();
    const storedCustomChains = getStoredChains();
    const storedSelectedChainId = getStoredSelectedChain();
    
    setIsTestnetEnabled(storedTestnetToggle);
    setCustomChains(storedCustomChains as unknown as Chain[]);
    
    // Restore selected chain if it exists
    if (storedSelectedChainId) {
      const allChains = [...chains, ...testnetChains, ...storedCustomChains];
      const storedChain = allChains.find(chain => chain.chainId === storedSelectedChainId);
      if (storedChain) {
        setSelectedChain(storedChain as unknown as Chain);
        console.log('Restored selected chain from storage:', storedChain.displayName, storedChain.chainId);
      } else {
        console.log('Stored chain not found in available chains:', storedSelectedChainId);
      }
    } else {
      console.log('No stored selected chain found, using default:', chains[0].displayName, chains[0].chainId);
    }
    
    // Mark as initialized after loading from storage
    setIsInitialized(true);
  }, []);

  // Combine chains based on testnet toggle
  const availableChains = React.useMemo(() => {
    const baseChains = chains as unknown as Chain[];
    const testnetChainsList = testnetChains as unknown as Chain[];
    
    return isTestnetEnabled 
      ? [...baseChains, ...testnetChainsList, ...customChains]
      : [...baseChains, ...customChains];
  }, [isTestnetEnabled, customChains]);

  // Update selected chain when available chains change
  useEffect(() => {
    const chainExists = availableChains.some(chain => chain.chainId === selectedChain.chainId);
    if (!chainExists && availableChains.length > 0) {
      setSelectedChain(availableChains[0]);
    }
  }, [availableChains, selectedChain.chainId]);

  const knownChains = availableChains;

  const getRpcUrl = () => {
    // Use RPC URL from chainConfig.ts
    return selectedChain.rpcUrl || 'https://mainnet.base.org';
  };

  const addCustomChain = (chain: Chain) => {
    setCustomChains(prev => {
      const exists = prev.some(c => c.chainId.toLowerCase() === chain.chainId.toLowerCase());
      return exists ? prev : [...prev, chain];
    });
  };

  const removeCustomChain = (chainId: string) => {
    setCustomChains(prev => prev.filter(c => c.chainId.toLowerCase() !== chainId.toLowerCase()));
  };

  const setTestnetEnabled = (enabled: boolean) => {
    setIsTestnetEnabled(enabled);
  };

  // Enhanced setSelectedChain that also saves to storage
  const setSelectedChainWithStorage = (chain: Chain) => {
    setSelectedChain(chain);
    saveSelectedChain(chain.chainId);
    console.log('Selected chain updated and saved:', chain.displayName, chain.chainId);
  };

  return (
    <ChainContext.Provider value={{ 
      selectedChain, 
      setSelectedChain: setSelectedChainWithStorage, 
      getRpcUrl, 
      knownChains, 
      addCustomChain, 
      removeCustomChain,
      isTestnetEnabled,
      setTestnetEnabled,
      availableChains,
      isInitialized
    }}>
      {children}
    </ChainContext.Provider>
  );
};

export const useChain = () => {
  const context = useContext(ChainContext);
  if (context === undefined) {
    throw new Error('useChain must be used within a ChainProvider');
  }
  return context;
};
