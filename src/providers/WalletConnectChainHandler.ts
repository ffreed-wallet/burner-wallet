import { SessionTypes } from '@walletconnect/types';

export interface ChainHandler {
  emitChainChangeEvent: (chainId: string, session: SessionTypes.Struct | null, signClient: any) => Promise<void>;
  emitAccountsChangeEvent: (accounts: string[], session: SessionTypes.Struct | null, signClient: any, chainId?: string) => Promise<void>;
}

export class WalletConnectChainHandler implements ChainHandler {
  async emitChainChangeEvent(
    chainId: string, 
    session: SessionTypes.Struct | null, 
    signClient: any
  ): Promise<void> {
    if (!signClient || !session) {
      return;
    }

    try {
      // Convert chainId to number (handle both hex and decimal formats)
      let chainIdNumber: number;
      if (chainId.startsWith('0x')) {
        chainIdNumber = parseInt(chainId, 16);
      } else {
        chainIdNumber = parseInt(chainId, 10);
      }
      
      await signClient.emit({
        topic: session.topic,
        event: {
          name: 'chainChanged',
          data: chainIdNumber
        },
        chainId: `eip155:${chainIdNumber}`
      });
      console.log('Chain change event emitted:', chainId, 'as number:', chainIdNumber);
    } catch (error) {
      console.error('Failed to emit chain change event:', error);
      console.error('Chain ID that failed:', chainId);
      throw error;
    }
  }

  async emitAccountsChangeEvent(
    accounts: string[], 
    session: SessionTypes.Struct | null, 
    signClient: any,
    chainId?: string
  ): Promise<void> {
    if (!signClient || !session) {
      return;
    }

    try {
      // Use provided chainId or fallback to session's first account chainId
      let targetChainId: string;
      if (chainId) {
        // Convert chainId to decimal format for eip155 namespace
        const chainIdNumber = chainId.startsWith('0x') 
          ? parseInt(chainId, 16) 
          : parseInt(chainId, 10);
        targetChainId = `eip155:${chainIdNumber}`;
      } else {
        targetChainId = `eip155:${parseInt(session.namespaces.eip155?.accounts?.[0]?.split(':')[1] || '1', 10)}`;
      }

      await signClient.emit({
        topic: session.topic,
        event: {
          name: 'accountsChanged',
          data: accounts
        },
        chainId: targetChainId
      });
      console.log('Accounts change event emitted:', accounts, 'for chain:', targetChainId);
    } catch (error) {
      console.error('Failed to emit accounts change event:', error);
      throw error;
    }
  }
}
