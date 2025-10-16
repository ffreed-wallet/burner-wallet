import { SessionTypes } from '@walletconnect/types';

export interface SessionManager {
  session: SessionTypes.Struct | null;
  isConnected: boolean;
  checkAndRestoreSessions: (signClient: any) => Promise<boolean>;
  handleSessionDelete: () => void;
  handleSessionUpdate: (event: any) => void;
  getWalletAddress: () => string | null;
}

export class WalletConnectSessionManager implements SessionManager {
  public session: SessionTypes.Struct | null = null;
  public isConnected: boolean = false;
  private setSession: (session: SessionTypes.Struct | null) => void;
  private setIsConnected: (connected: boolean) => void;

  constructor(
    session: SessionTypes.Struct | null,
    isConnected: boolean,
    setSession: (session: SessionTypes.Struct | null) => void,
    setIsConnected: (connected: boolean) => void
  ) {
    this.session = session;
    this.isConnected = isConnected;
    this.setSession = setSession;
    this.setIsConnected = setIsConnected;
  }

  async checkAndRestoreSessions(signClient: any): Promise<boolean> {
    if (!signClient) return false;
    
    try {
      const sessions = signClient.session.getAll();
      console.log('Found existing sessions:', sessions.length);
      
      if (sessions.length > 0) {
        const activeSession = sessions[0];
        console.log('Restoring active session:', {
          topic: activeSession.topic,
          namespaces: activeSession.namespaces,
          accounts: activeSession.namespaces.eip155?.accounts
        });
        this.setSession(activeSession);
        this.setIsConnected(true);
        console.log('Session restored successfully');
        return true;
      }
      
      console.log('No existing sessions found');
      return false;
    } catch (error) {
      console.error('Error checking sessions:', error);
      return false;
    }
  }

  handleSessionDelete(): void {
    console.log('Session deleted');
    this.setSession(null);
    this.setIsConnected(false);
  }

  handleSessionUpdate(event: any): void {
    console.log('Session updated:', event);
    if (event.params.namespaces && this.session) {
      const updatedSession = { ...this.session, namespaces: event.params.namespaces };
      this.setSession(updatedSession);
    }
  }

  getWalletAddress(): string | null {
    if (!this.session) return null;
    
    const rawSessionAddress = this.session.namespaces.eip155?.accounts?.[0];
    if (!rawSessionAddress) return null;
    
    // Extract address from eip155 format (eip155:1:0x...) or use as-is if already clean
    return rawSessionAddress.includes(':') 
      ? rawSessionAddress.split(':').pop() || null
      : rawSessionAddress;
  }
}
