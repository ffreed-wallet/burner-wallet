import { SessionTypes } from '@walletconnect/types';

export interface RequestProcessor {
  processRequest: (
    request: any,
    session: SessionTypes.Struct | null,
    walletAddress: string | null,
    libBurnerConnected: boolean,
    burner: any,
    selectedChain: any,
    setSelectedChain: (chain: any) => void,
    emitChainChangeEvent: (chainId: string) => Promise<void>,
    keyPassword?: string
  ) => Promise<any>;
}

export class WalletConnectRequestProcessor implements RequestProcessor {
  async processRequest(
    request: any,
    session: SessionTypes.Struct | null,
    walletAddress: string | null,
    libBurnerConnected: boolean,
    burner: any,
    selectedChain: any,
    setSelectedChain: (chain: any) => void,
    emitChainChangeEvent: (chainId: string) => Promise<void>,
    keyPassword?: string
  ): Promise<any> {
    let result: any;
    
    // Get the wallet address from session or fallback to current wallet
    const rawSessionAddress = session?.namespaces.eip155?.accounts?.[0] || walletAddress;
    
    // For sessionless methods, we can use the LibBurner wallet address directly
    const isSessionlessMethod = ['wallet_getCapabilities', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'].includes(request.params.request.method);
    
    if (!rawSessionAddress && !isSessionlessMethod) {
      throw new Error('No wallet address available for request processing');
    }
    
    if (!rawSessionAddress && isSessionlessMethod && !walletAddress) {
      throw new Error('No wallet address available for sessionless method processing');
    }
    
    // For sessionless methods, ensure LibBurner is connected
    if (isSessionlessMethod && !libBurnerConnected) {
      throw new Error('LibBurner not connected for sessionless method processing');
    }
    
    // Extract address from eip155 format (eip155:1:0x...) or use as-is if already clean
    const sessionWalletAddress = rawSessionAddress && rawSessionAddress.includes(':') 
      ? rawSessionAddress.split(':').pop() || walletAddress
      : rawSessionAddress || walletAddress;
      
    if (!sessionWalletAddress) {
      throw new Error('Failed to resolve wallet address from session or LibBurner');
    }
    
    console.log('Wallet address resolution:', {
      hasSession: !!session,
      sessionTopic: session?.topic,
      requestTopic: request.topic,
      rawSessionAddress,
      sessionWalletAddress,
      walletAddress,
      libBurnerConnected,
      method: request.params.request.method,
      isSessionlessMethod
    });

    switch (request.params.request.method) {
      case 'eth_accounts':
        result = [sessionWalletAddress];
        break;
      case 'eth_chainId':
        result = `0x${parseInt(selectedChain.chainId).toString(16)}`;
        break;
      case 'eth_requestAccounts':
        result = [sessionWalletAddress];
        break;
      case 'eth_blockNumber': {
        const publicClient = burner._getPublicClient?.();
        if (!publicClient) throw new Error('Public client not available');
        const bn = await publicClient.getBlockNumber();
        result = `0x${bn.toString(16)}`;
        break;
      }
      case 'eth_gasPrice': {
        const publicClient = burner._getPublicClient?.();
        if (!publicClient) throw new Error('Public client not available');
        const gp = await publicClient.getGasPrice();
        result = `0x${gp.toString(16)}`;
        break;
      }
      case 'eth_estimateGas': {
        const publicClient = burner._getPublicClient?.();
        if (!publicClient) throw new Error('Public client not available');
        const tx = request.params.request.params?.[0] || {};
        const gas = await publicClient.estimateGas({
          account: (tx.from as string | undefined) as `0x${string}` | undefined,
          to: (tx.to as string | undefined) as `0x${string}` | undefined,
          data: (tx.data as string | undefined) as `0x${string}` | undefined,
          value: tx.value ? BigInt(tx.value) : undefined,
        } as any);
        result = `0x${gas.toString(16)}`;
        break;
      }
      case 'eth_getCode': {
        const publicClient = burner._getPublicClient?.();
        if (!publicClient) throw new Error('Public client not available');
        const [address, blockTag] = request.params.request.params || [];
        const code = await publicClient.getBytecode({
          address: address as `0x${string}`,
          blockTag: (blockTag as any) || 'latest',
        } as any);
        result = code ?? '0x';
        break;
      }
      case 'eth_call': {
        const publicClient = burner._getPublicClient?.();
        if (!publicClient) throw new Error('Public client not available');
        const [tx, blockTag] = request.params.request.params || [];
        const callRes = await publicClient.call({
          to: (tx?.to as string | undefined) as `0x${string}` | undefined,
          data: (tx?.data as string | undefined) as `0x${string}` | undefined,
          account: (tx?.from as string | undefined) as `0x${string}` | undefined,
          value: tx?.value ? BigInt(tx.value) : undefined,
          blockTag: (blockTag as any) || 'latest',
        } as any);
        // viem returns { data } for call
        result = (callRes as any)?.data ?? '0x';
        break;
      }
      case 'wallet_getCapabilities': {
        // Build capabilities the wallet supports
        const { chains } = await import('../chainConfig');
        const supportedEip155Chains = chains.map((c) => `eip155:${parseInt(c.chainId, 16)}`);
        result = {
          eip155: {
            methods: [
              'eth_accounts',
              'eth_chainId',
              'eth_requestAccounts',
              'eth_getBalance',
              'eth_blockNumber',
              'eth_gasPrice',
              'eth_estimateGas',
              'eth_getCode',
              'eth_call',
              'eth_getTransactionCount',
              'eth_sendTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
              'wallet_switchEthereumChain',
              'wallet_addEthereumChain',
            ],
            events: ['accountsChanged', 'chainChanged'],
            chains: supportedEip155Chains,
          },
        };
        break;
      }
      case 'wallet_switchEthereumChain':
        return this.handleChainSwitch(request, setSelectedChain, emitChainChangeEvent, session, selectedChain);
      case 'wallet_addEthereumChain':
        return this.handleAddChain(request);
      case 'eth_getBalance':
        return this.handleGetBalance(burner);
      case 'eth_getTransactionCount':
        return this.handleGetTransactionCount(burner, sessionWalletAddress);
      case 'eth_sendTransaction':
        return this.handleSendTransaction(request, burner, sessionWalletAddress);
      case 'eth_sign':
        return this.handleSign(request, burner, sessionWalletAddress);
      case 'personal_sign':
        return this.handlePersonalSign(request, burner, sessionWalletAddress);
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return this.handleSignTypedData(request, burner, sessionWalletAddress);
      default:
        throw new Error(`Unsupported method: ${request.params.request.method}`);
    }

    return result;
  }

  private async handleChainSwitch(
    request: any,
    setSelectedChain: (chain: any) => void,
    emitChainChangeEvent: (chainId: string) => Promise<void>,
    session: SessionTypes.Struct | null,
    currentChain: any
  ): Promise<null> {
    const switchParams = request.params.request.params[0];
    const targetChainId = switchParams.chainId;
    console.log('WalletConnect requesting chain switch to:', targetChainId);
    console.log('Switch params:', switchParams);
    
    // Check if the requested chain is already the current chain
    // Normalize chain IDs for comparison (handle hex vs decimal)
    const normalizeChainId = (chainId: string) => {
      if (!chainId) return null;
      // Convert to hex format for consistent comparison
      if (chainId.startsWith('0x')) {
        return chainId.toLowerCase();
      } else {
        // Assume it's decimal, convert to hex
        const decimal = parseInt(chainId, 10);
        if (isNaN(decimal)) return null;
        return `0x${decimal.toString(16)}`;
      }
    };
    
    const normalizedTarget = normalizeChainId(targetChainId);
    const normalizedCurrent = normalizeChainId(currentChain?.chainId);
    
    console.log('Chain comparison in processor:', {
      targetChainId,
      currentChainId: currentChain?.chainId,
      normalizedTarget,
      normalizedCurrent,
      isSameChain: normalizedTarget === normalizedCurrent
    });
    
    if (normalizedTarget && normalizedCurrent && normalizedTarget === normalizedCurrent) {
      console.log('Requested chain is already active, emitting chain change event without switching');
      
      // Emit chain change event to notify dApp (only if we have a session)
      if (session) {
        try {
          console.log('Emitting chain change event for already active chain:', session.topic);
          await emitChainChangeEvent(currentChain.chainId);
          console.log('Chain change event emitted successfully for active chain');
        } catch (emitError) {
          console.error('Failed to emit chain change event:', emitError);
          // Don't throw here - chain is already correct, just event emission failed
        }
      } else {
        console.log('No session available for chain change event');
      }
      
      return null;
    }
    
    // Import chains dynamically to avoid circular dependencies
    const { chains, testnetChains } = await import('../chainConfig');
    const allChains = [...chains, ...testnetChains];
    
    // Find the chain in our configuration (check both hex and decimal formats)
    let targetChain = allChains.find(chain => chain.chainId === targetChainId);
    
    // If not found, try converting decimal to hex
    if (!targetChain && targetChainId && !targetChainId.startsWith('0x')) {
      const hexChainId = `0x${parseInt(targetChainId, 10).toString(16)}`;
      targetChain = allChains.find(chain => chain.chainId === hexChainId);
      console.log('Trying hex format:', hexChainId, 'Found:', !!targetChain);
    }
    
    console.log('Available chains:', allChains.map(c => ({ id: c.chainId, name: c.displayName })));
    console.log('Found target chain:', targetChain ? `${targetChain.displayName} (${targetChain.chainId})` : 'NOT FOUND');
    
    if (targetChain) {
      try {
        // Switch chain for the whole app
        console.log('Setting selected chain to:', targetChain);
        setSelectedChain(targetChain);
        console.log('Switched to chain:', targetChain.displayName);
        
        // Give a small delay to ensure LibBurner updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Emit chain change event to notify dApp (only if we have a session)
        if (session) {
          try {
            console.log('Emitting chain change event for session:', session.topic);
            await emitChainChangeEvent(targetChain.chainId);
            console.log('Chain change event emitted successfully');
          } catch (emitError) {
            console.error('Failed to emit chain change event:', emitError);
            // Don't throw here - chain switch was successful, just event emission failed
          }
        } else {
          console.log('No session available for chain change event');
        }
        
        return null;
      } catch (switchError) {
        console.error('Error switching chain:', switchError);
        throw {
          code: 4902,
          message: 'User rejected the request'
        };
      }
    } else {
      // Chain not found - return error code 4902
      throw {
        code: 4902,
        message: `Chain ${targetChainId} not found. Please add the chain first.`
      };
    }
  }

  private handleAddChain(request: any): null {
    const addParams = request.params.request.params[0];
    console.log('Add chain request:', addParams);
    // Acknowledge; Provider will prompt user to add this chain to app state
    return null;
  }

  private async handleGetBalance(burner: any): Promise<string> {
    if (!burner) {
      throw new Error('LibBurner not available for balance check');
    }
    const balance = await burner.getGasTokenBalance();
    return `0x${balance.toString(16)}`;
  }

  private async handleGetTransactionCount(burner: any, sessionWalletAddress: string): Promise<string> {
    if (!burner) {
      throw new Error('LibBurner not available for transaction count');
    }
    
    try {
      const publicClient = burner._getPublicClient();
      if (!publicClient) {
        throw new Error('Public client not available');
      }
      
      const nonce = await publicClient.getTransactionCount({
        address: sessionWalletAddress as `0x${string}`,
        blockTag: 'pending'
      });
      return `0x${nonce.toString(16)}`;
    } catch (error) {
      console.error('Error getting transaction count:', error);
      return '0x0';
    }
  }

  private async handleSendTransaction(request: any, burner: any, sessionWalletAddress: string): Promise<string> {
    if (!burner) {
      throw new Error('LibBurner not available for transaction sending');
    }

    const txParams = request.params.request.params[0];
    console.log('Sending transaction:', txParams);
    
    const walletClient = burner._getWalletClient?.();
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }
    const account = burner.asViemAccount();

    const to = txParams.to as `0x${string}` | undefined;
    const value = txParams.value ? BigInt(txParams.value) : undefined;
    const data = txParams.data as `0x${string}` | undefined;
    const gas = txParams.gas || txParams.gasLimit ? BigInt(txParams.gas || txParams.gasLimit) : undefined;
    const gasPrice = txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined;
    const nonce = typeof txParams.nonce !== 'undefined' ? BigInt(txParams.nonce) : undefined;

    const hash = await walletClient.sendTransaction({
      account: account as any,
      to,
      value,
      data,
      gas,
      gasPrice,
      nonce,
    });

    return hash as string;
  }

  private async handleSign(request: any, burner: any, sessionWalletAddress: string): Promise<string> {
    if (!burner) {
      throw new Error('LibBurner not available for signing');
    }

    const [address, message] = request.params.request.params;
    console.log('eth_sign message:', message);

    const walletClient = burner._getWalletClient?.();
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }
    const account = burner.asViemAccount();

    // eth_sign expects signing raw bytes; viem signMessage can accept hex via { raw }
    const signature = await walletClient.signMessage({
      account: account as any,
      message: typeof message === 'string' && message.startsWith('0x') ? { raw: message as `0x${string}` } : message,
    } as any);

    return String(signature);
  }

  private async handlePersonalSign(request: any, burner: any, sessionWalletAddress: string): Promise<string> {
    if (!burner) {
      throw new Error('LibBurner not available for personal signing');
    }

    // personal_sign expects [message, address], but WalletConnect uses [string, string] and viem expects message as a string (not a hex hash)
    const [message, address] = request.params.request.params;
    console.log('personal_sign message (hex-hash):', message);

    const walletClient = burner._getWalletClient?.();
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }
    const account = burner.asViemAccount();

    // If message is hex (e.g. "0x..."), sign raw bytes to match dApp expectations
    // Otherwise, sign the provided string as-is
    let msgToSign: any;
    if (typeof message === 'string' && message.startsWith('0x')) {
      msgToSign = { raw: message as `0x${string}` };
    } else {
      msgToSign = message;
    }

    const signature = await walletClient.signMessage({
      account: account as any,
      message: msgToSign,
    } as any);

    return String(signature);
  }

  private async handleSignTypedData(request: any, burner: any, sessionWalletAddress: string): Promise<string> {
    if (!burner) {
      throw new Error('LibBurner not available for typed data signing');
    }

    const [address, typedData] = request.params.request.params;
    console.log('eth_signTypedData_v4 payload:', typedData);

    const walletClient = burner._getWalletClient?.();
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }
    const account = burner.asViemAccount();

    const payload = typeof typedData === 'string' ? JSON.parse(typedData) : typedData;
    const { domain, types, message, primaryType } = payload;

    const signature = await walletClient.signTypedData({
      account: account as any,
      domain,
      types,
      primaryType,
      message,
    } as any);

    return String(signature);
  }
}
