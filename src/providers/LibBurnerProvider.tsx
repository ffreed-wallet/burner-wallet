import React, { createContext, useContext, useEffect, useState } from 'react';
import Burner from '@arx-research/libburner';
import { HaloCommandObject, HaloResponseObject } from '@arx-research/libhalo/types';
import { execHaloCmdWeb } from '@arx-research/libhalo/api/web';
import { useChain } from './ChainProvider';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { mainnet, base, polygon, bsc, optimism, sepolia, goerli, baseSepolia, polygonMumbai, bscTestnet, optimismGoerli } from 'viem/chains';
import axios from 'axios';
import { getTokenBalancesWithMetadata, getNativeTokenBalance } from '@/lib/alchemy';

// Helper function to resolve viem chain from chainId
const resolveViemChain = (chainId: string) => {
  switch (chainId) {
    // Mainnet chains
    case '0x1': return mainnet;
    case '0x2105': return base;
    case '0x89': return polygon;
    case '0x38': return bsc;
    case '0xa': return optimism;
    // Testnet chains
    case '0xaa36a7': return sepolia;
    case '0x5': return goerli;
    case '0x14a33': return baseSepolia;
    case '0x13881': return polygonMumbai;
    case '0x61': return bscTestnet;
    case '0x1a4': return optimismGoerli;
    default: return base;
  }
};

interface LibBurnerContextType {
  burner: Burner | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  walletAddress: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  getData: () => Promise<any>;
  getUSD2Balance: () => Promise<bigint>;
  getUSDCBalance: () => Promise<bigint>;
  getGasTokenBalance: () => Promise<bigint>;
  getZapperBalances: () => Promise<any>;
  getTokenBalances: (tokenAddresses: string[]) => Promise<any[]>;
  getTokenMetadata: (tokenAddresses: string[]) => Promise<any[]>;
  getEnsName: (address: string) => Promise<string | null>;
  getEnsAddress: (name: string) => Promise<string | null>;
  sendUSD2: (destinationAddress: string, amount: bigint, pin?: string) => Promise<string>;
  sendUSDC: (destinationAddress: string, amount: bigint, pin?: string) => Promise<string>;
  sendGasToken: (destinationAddress: string, amount: bigint, pin?: string) => Promise<string>;
  sendERC20Token: (tokenAddress: string, destinationAddress: string, amount: bigint, pin?: string) => Promise<string>;
  // New Alchemy API methods
  getAlchemyTokenBalances: (address?: string) => Promise<any[]>;
  getAlchemyNativeBalance: (address?: string) => Promise<bigint>;
}

const LibBurnerContext = createContext<LibBurnerContextType | undefined>(undefined);

export const useLibBurner = () => {
  const context = useContext(LibBurnerContext);
  if (!context) {
    throw new Error('useLibBurner must be used within a LibBurnerProvider');
  }
  return context;
};

interface LibBurnerProviderProps {
  children: React.ReactNode;
}

export const LibBurnerProvider: React.FC<LibBurnerProviderProps> = ({ children }) => {
  const [burner, setBurner] = useState<Burner | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { getRpcUrl, selectedChain } = useChain();

  // Load connection state from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('libburner_address');
    const savedConnection = localStorage.getItem('libburner_connected') === 'true';
    
    if (savedAddress && savedConnection) {
      setWalletAddress(savedAddress);
      setIsConnected(true);
    }
  }, []);

  useEffect(() => {
    // Initialize LibBurner and patch clients to follow selectedChain
    const initLibBurner = async () => {
      try {
        const haloExecCb = async (cmd: HaloCommandObject): Promise<HaloResponseObject> => {
          return await execHaloCmdWeb(cmd);
        };

        const burnerInstance = new Burner({
          haloExecCb,
          chainRpcUrls: {
            http: [getRpcUrl()]
          }
        });

        const patchClients = (inst: any) => {
          inst._getPublicClient = () => createPublicClient({
            chain: resolveViemChain(selectedChain.chainId),
            transport: http(getRpcUrl())
          });
          inst._getWalletClient = () => createWalletClient({
            chain: resolveViemChain(selectedChain.chainId),
            transport: http(getRpcUrl()),
            account: inst.asViemAccount() as any,
          });
        };

        patchClients(burnerInstance);
        setBurner(burnerInstance);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize LibBurner');
      }
    };

    initLibBurner();
  }, [getRpcUrl]);

  // Keep burner clients in sync with selectedChain changes
  useEffect(() => {
    if (!burner || !isConnected) return;
    
    const switchChain = async () => {
      try {
        console.log('LibBurner chain switch triggered for:', selectedChain.displayName, selectedChain.chainId);
        const inst: any = burner;
        const chain = resolveViemChain(selectedChain.chainId);
        
        // Update the wallet client with the new chain
        inst._getPublicClient = () => createPublicClient({
          chain: chain,
          transport: http(getRpcUrl())
        });
        inst._getWalletClient = () => createWalletClient({
          chain: chain,
          transport: http(getRpcUrl()),
          account: inst.asViemAccount() as any,
        });
        
        console.log(`Updated LibBurner clients for chain: ${chain.name} (${chain.id})`);
      } catch (e) {
        console.error('Failed to update LibBurner chain:', e);
      }
    };
    
    switchChain();
  }, [burner, selectedChain.chainId, getRpcUrl, isConnected]);

  const connect = async () => {
    if (!burner) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      // Get data from the burner tag to connect
      const data = await burner.getData();
      setWalletAddress(data.address);
      setIsConnected(true);
      
      // Save to localStorage
      localStorage.setItem('libburner_address', data.address);
      localStorage.setItem('libburner_connected', 'true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setWalletAddress(null);
    
    // Clear localStorage
    localStorage.removeItem('libburner_address');
    localStorage.removeItem('libburner_connected');
  };

  const getData = async () => {
    if (!burner) {
      throw new Error('LibBurner not initialized');
    }
    
    try {
      return await burner.getData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get data');
      throw err;
    }
  };

  const getUSD2Balance = async () => {
    if (!burner || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      return await burner.getUSD2Balance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get USD2 balance');
      throw err;
    }
  };

  const getUSDCBalance = async () => {
    if (!burner || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      return await burner.getUSDCBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get USDC balance');
      throw err;
    }
  };

  const getGasTokenBalance = async () => {
    if (!walletAddress || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      // Get the appropriate chain for viem
      const chain = resolveViemChain(selectedChain.chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(getRpcUrl())
      });

      const balance = await publicClient.getBalance({
        address: walletAddress as `0x${string}`
      });

      return balance;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get gas token balance');
      throw err;
    }
  };

  const getZapperBalances = async () => {
    if (!walletAddress || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      const response = await axios.get(
        "https://api.zapper.xyz/v2/balances/apps",
        {
          headers: {
            accept: "*/*",
            Authorization:
              "Basic MDZhMDYwYjctYWUxMi00N2U0LTkxZGItM2IzNTI2ODEzMTNjOg==",
          },
          params: {
            addresses: [walletAddress],
          },
        }
      );

      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get Zapper balances');
      throw err;
    }
  };

  const getTokenMetadata = async (tokenAddresses: string[]) => {
    try {
      // Get the appropriate chain for viem
      const chain = resolveViemChain(selectedChain.chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(getRpcUrl())
      });

      // ERC-20 standard ABI for fetching token metadata
      const metadataAbi = [
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

      // Fetch metadata for all tokens in parallel
      const metadataPromises = tokenAddresses.map(async (tokenAddress) => {
        try {
          const [decimals, symbol, name] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: metadataAbi,
              functionName: 'decimals',
            }),
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: metadataAbi,
              functionName: 'symbol',
            }),
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: metadataAbi,
              functionName: 'name',
            })
          ]);

          return {
            address: tokenAddress,
            decimals: decimals as number,
            symbol: symbol as string,
            name: name as string
          };
        } catch (err) {
          console.error(`Failed to fetch metadata for token ${tokenAddress}:`, err);
          return {
            address: tokenAddress,
            decimals: 18,
            symbol: 'UNKNOWN',
            name: 'Unknown Token'
          };
        }
      });

      const results = await Promise.all(metadataPromises);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get token metadata');
      throw err;
    }
  };

  const getTokenBalances = async (tokenAddresses: string[]) => {
    if (!walletAddress || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      // Get the appropriate chain for viem
      const chain = resolveViemChain(selectedChain.chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(getRpcUrl())
      });

      // ERC-20 standard ABI for fetching token metadata and balances
      const balanceOfAbi = [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }]
        },
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

      // Fetch balances for all tokens in parallel
      const balancePromises = tokenAddresses.map(async (tokenAddress) => {
        try {
          const [balance, decimals, symbol, name] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: balanceOfAbi,
              functionName: 'balanceOf',
              args: [walletAddress as `0x${string}`],
            }),
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: balanceOfAbi,
              functionName: 'decimals',
            }),
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: balanceOfAbi,
              functionName: 'symbol',
            }),
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: balanceOfAbi,
              functionName: 'name',
            })
          ]);

          return {
            address: tokenAddress,
            balance: balance as bigint,
            decimals: decimals as number,
            symbol: symbol as string,
            name: name as string
          };
        } catch (err) {
          console.error(`Failed to fetch balance for token ${tokenAddress}:`, err);
          return {
            address: tokenAddress,
            balance: BigInt(0),
            decimals: 18,
            symbol: 'UNKNOWN',
            name: 'Unknown Token'
          };
        }
      });

      const results = await Promise.all(balancePromises);
      return results; // Return all tokens, including those with zero balances
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get token balances');
      throw err;
    }
  };

  const getEnsName = async (address: string) => {
    try {
      // Create a public client for mainnet (ENS is on Ethereum mainnet)
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http('https://ethereum-rpc.publicnode.com')
      });

      const ensName = await publicClient.getEnsName({
        address: address as `0x${string}`
      });
      
      console.log('ENS name:', ensName);

      return ensName;
    } catch (err) {
      console.error('Failed to get ENS name:', err);
      return null;
    }
  };

  const getEnsAddress = async (name: string) => {
    try {
      // Create a public client for mainnet (ENS is on Ethereum mainnet)
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http('https://ethereum-rpc.publicnode.com')
      });

      const ensAddress = await publicClient.getEnsAddress({
        name: name
      });

      return ensAddress;
    } catch (err) {
      console.error('Failed to get ENS address:', err);
      return null;
    }
  };

  const sendUSD2 = async (destinationAddress: string, amount: bigint, pin?: string) => {
    if (!burner || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      // Set password if provided
      if (pin && typeof (burner as any).setPassword === 'function') {
        (burner as any).setPassword(pin);
      }
      
      return await burner.sendUSD2({
        destinationAddress: destinationAddress as `0x${string}`,
        amount: amount
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send USD2');
      throw err;
    }
  };

  const sendUSDC = async (destinationAddress: string, amount: bigint, pin?: string) => {
    if (!burner || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      // Set password if provided
      if (pin && typeof (burner as any).setPassword === 'function') {
        (burner as any).setPassword(pin);
      }
      
      return await burner.sendUSDC({
        destinationAddress: destinationAddress as `0x${string}`,
        amount: amount
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send USDC');
      throw err;
    }
  };

  const sendGasToken = async (destinationAddress: string, amount: bigint, pin?: string) => {
    if (!walletAddress || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      // Set password if provided
      if (pin && typeof (burner as any).setPassword === 'function') {
        (burner as any).setPassword(pin);
      }
      
      // Get the appropriate chain for viem
      const chain = resolveViemChain(selectedChain.chainId);
      
      // Get the wallet client from LibBurner
      const walletClient = burner._getWalletClient();
      
      if (!walletClient) {
        throw new Error('Wallet client not available');
      }

      console.log('Sending gas token:', {
        to: destinationAddress,
        amount: amount.toString(),
        from: walletAddress,
        chain: chain.name
      });
      
      // Send the native token transaction
      const account = burner.asViemAccount();
      console.log('Account from burner:', account);
      console.log('Wallet client chain:', walletClient.chain);
      
      const hash = await walletClient.sendTransaction({
        to: destinationAddress as `0x${string}`,
        value: amount,
        account: account as any,
        chain: chain as any,
        kzg: undefined
      });
      
      return hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send gas token');
      throw err;
    }
  };

  const sendERC20Token = async (tokenAddress: string, destinationAddress: string, amount: bigint, pin?: string) => {
    if (!walletAddress || !isConnected) {
      throw new Error('LibBurner not connected');
    }
    
    try {
      // Set password if provided
      if (pin && typeof (burner as any).setPassword === 'function') {
        (burner as any).setPassword(pin);
      }
      
      // Get the appropriate chain for viem
      const chain = resolveViemChain(selectedChain.chainId);
      const publicClient = createPublicClient({
        chain,
        transport: http(getRpcUrl())
      });

      // Get the wallet client from LibBurner
      const walletClient = burner._getWalletClient();
      
      if (!walletClient) {
        throw new Error('Wallet client not available');
      }

      // ERC-20 transfer function signature
      const transferAbi = [
        {
          name: 'transfer',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }]
        }
      ];

      // Send the ERC-20 transfer transaction
      const account = burner.asViemAccount();
      console.log('ERC-20 Account from burner:', account);
      console.log('ERC-20 Wallet client chain:', walletClient.chain);
      
      const hash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: transferAbi,
        functionName: 'transfer',
        args: [destinationAddress as `0x${string}`, amount],
        account: account as any,
        chain: chain as any
      });

      return hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send ERC-20 token');
      throw err;
    }
  };

  // New Alchemy API methods
  const getAlchemyTokenBalances = async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) {
      throw new Error('No address provided');
    }

    try {
      const tokens = await getTokenBalancesWithMetadata(targetAddress, selectedChain.chainId);
      return tokens;
    } catch (err) {
      console.error('Error fetching Alchemy token balances:', err);
      throw err;
    }
  };

  const getAlchemyNativeBalance = async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) {
      throw new Error('No address provided');
    }

    try {
      const balance = await getNativeTokenBalance(targetAddress, selectedChain.chainId);
      return balance;
    } catch (err) {
      console.error('Error fetching Alchemy native balance:', err);
      throw err;
    }
  };

  const value: LibBurnerContextType = {
    burner,
    isConnected,
    isConnecting,
    error,
    walletAddress,
    connect,
    disconnect,
    getData,
    getUSD2Balance,
    getUSDCBalance,
    getGasTokenBalance,
    getZapperBalances,
    getTokenBalances,
    getTokenMetadata,
    getEnsName,
    getEnsAddress,
    sendUSD2,
    sendUSDC,
    sendGasToken,
    sendERC20Token,
    getAlchemyTokenBalances,
    getAlchemyNativeBalance,
  };

  return (
    <LibBurnerContext.Provider value={value}>
      {children}
    </LibBurnerContext.Provider>
  );
};
