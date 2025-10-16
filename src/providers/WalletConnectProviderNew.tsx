import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { SignClient } from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { useLibBurner } from './LibBurnerProvider';
import { useChain } from './ChainProvider';
import { WalletConnectSessionManager } from './WalletConnectSessionManager';
import { WalletConnectRequestProcessor } from './WalletConnectRequestProcessor';
import { WalletConnectChainHandler } from './WalletConnectChainHandler';

interface WalletConnectContextType {
  isConnected: boolean;
  session: SessionTypes.Struct | null;
  connect: (uri: string) => Promise<void>;
  disconnect: () => Promise<void>;
  approveSession: (sessionProposal: any) => Promise<void>;
  rejectSession: (sessionProposal: any) => Promise<void>;
  approveRequest: (request: any) => Promise<void>;
  rejectRequest: (request: any) => Promise<void>;
  pendingSession: any | null;
  pendingRequests: any[];
  checkAndRestoreSessions: () => Promise<boolean>;
}

const WalletConnectContext = createContext<WalletConnectContextType | undefined>(undefined);

export const useWalletConnect = () => {
  const context = useContext(WalletConnectContext);
  if (context === undefined) {
    throw new Error('useWalletConnect must be used within a WalletConnectProvider');
  }
  return context;
};

interface WalletConnectProviderProps {
  children: React.ReactNode;
}

export function WalletConnectProvider({ children }: WalletConnectProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState<SessionTypes.Struct | null>(null);
  const [pendingSession, setPendingSession] = useState<any | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinPromptTitle, setPinPromptTitle] = useState('');
  const [pinPromptDescription, setPinPromptDescription] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const signClientRef = useRef<any>(null);
  
  // Get the actual wallet address from LibBurner
  const { walletAddress, burner, getGasTokenBalance, isConnected: libBurnerConnected } = useLibBurner();
  const { selectedChain, setSelectedChain } = useChain();

  // Initialize managers
  const sessionManager = new WalletConnectSessionManager(session, isConnected, setSession, setIsConnected);
  const requestProcessor = new WalletConnectRequestProcessor();
  const chainHandler = new WalletConnectChainHandler();

  useEffect(() => {
    initializeWalletConnect();
    
    return () => {
      if (signClientRef.current) {
        try {
          const sessions = signClientRef.current.session.getAll();
          sessions.forEach(session => {
            try {
              signClientRef.current.disconnect({
                topic: session.topic,
                reason: getSdkError('USER_DISCONNECTED')
              });
            } catch (error) {
              console.warn('Error cleaning up session:', error);
            }
          });
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      }
    };
  }, []);

  const initializeWalletConnect = async () => {
    try {
      const signClient = await SignClient.init({
        projectId: 'your-project-id', // Replace with actual project ID
        metadata: {
          name: 'Wallet',
          description: 'A simple wallet',
          url: 'https://wallet.example.com',
          icons: ['https://wallet.example.com/icon.png']
        }
      });
      
      signClientRef.current = signClient;
      console.log('WalletConnect initialized successfully');

      // Set up event listeners
      setupEventListeners(signClient);
      
      // Check for existing sessions
      await sessionManager.checkAndRestoreSessions(signClient);
      
      console.log('WalletConnect initialization completed successfully');
    } catch (error) {
      console.error('Failed to initialize WalletConnect:', error);
    }
  };

  const setupEventListeners = (signClient: any) => {
    // Session proposal listener
    signClient.on('session_proposal', (event: any) => {
      console.log('Session proposal received:', event);
      setPendingSession(event);
      setShowRequestModal(true);
    });

    // Session request listener
    signClient.on('session_request', (event: any) => {
      console.log('Session request received:', event);
      handleSessionRequest(event);
    });

    // Session delete listener
    signClient.on('session_delete', () => {
      sessionManager.handleSessionDelete();
      setShowRequestModal(false);
      setCurrentRequest(null);
      setPendingRequests([]);
    });

    // Session update listener
    signClient.on('session_update', (event: any) => {
      sessionManager.handleSessionUpdate(event);
    });

    // Session event listener
    signClient.on('session_event', (event: any) => {
      console.log('Session event received:', event);
    });
  };

  const handleSessionRequest = async (event: any) => {
    console.log('Session request details:', event);
    console.log('Current session state:', {
      hasSession: !!session,
      sessionTopic: session?.topic,
      requestTopic: event.topic,
      isConnected: isConnected
    });
    
    // Check if this is a request to a non-existent session
    if (!session || session.topic !== event.topic) {
      console.warn('Request received for non-existent or mismatched session:', {
        requestTopic: event.topic,
        sessionTopic: session?.topic,
        hasSession: !!session
      });
      
      // For sessionless methods, we can still process them
      const sessionlessMethods = ['wallet_getCapabilities', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'];
      if (sessionlessMethods.includes(event.params.request.method)) {
        console.log('Processing sessionless method:', event.params.request.method);
        setCurrentRequest(event);
        try {
          await processWalletConnectRequest(event);
        } catch (error) {
          console.error('Error processing sessionless request:', error);
          await sendErrorResponse(event, error);
        }
      } else {
        console.log('Request requires active session, adding to pending requests');
        setPendingRequests(prev => [...prev, event]);
        setShowRequestModal(true);
      }
    } else {
      // Process request immediately for active session
      setCurrentRequest(event);
      try {
        await processWalletConnectRequest(event);
      } catch (error) {
        console.error('Error processing request:', error);
        await sendErrorResponse(event, error);
      }
    }
  };

  const processWalletConnectRequest = async (request: any) => {
    if (!request) {
      console.error('No request available');
      return;
    }

    console.log('Processing WalletConnect request:', {
      method: request.params.request.method,
      id: request.id,
      topic: request.topic
    });

    setIsProcessingRequest(true);

    try {
      const result = await requestProcessor.processRequest(
        request,
        session,
        walletAddress,
        libBurnerConnected,
        burner,
        selectedChain,
        setSelectedChain,
        (chainId: string) => chainHandler.emitChainChangeEvent(chainId, session, signClientRef.current)
      );

      // Send success response
      await sendSuccessResponse(request, result);
    } catch (error) {
      console.error('Error processing request:', error);
      await sendErrorResponse(request, error);
    } finally {
      setIsProcessingRequest(false);
      setCurrentRequest(null);
      setShowPinPrompt(false);
    }
  };

  const sendSuccessResponse = async (request: any, result: any) => {
    const response = {
      topic: request.topic,
      response: {
        id: request.id,
        jsonrpc: '2.0',
        result: result
      }
    };

    try {
      await signClientRef.current.respond(response);
      console.log('Response sent successfully to dApp');
    } catch (respondError) {
      console.error('Error sending response to dApp:', respondError);
    }
  };

  const sendErrorResponse = async (request: any, error: any) => {
    const errorCode = (error as any)?.code || -32000;
    const errorMessage = (error as any)?.message || (error instanceof Error ? error.message : 'Unknown error');
    
    const errorResponse = {
      topic: request.topic,
      response: {
        id: request.id,
        jsonrpc: '2.0',
        error: {
          code: errorCode,
          message: errorMessage
        }
      }
    };

    try {
      await signClientRef.current.respond(errorResponse);
    } catch (respondError) {
      console.error('Failed to send error response:', respondError);
    }
  };

  const connect = async (uri: string) => {
    if (!signClientRef.current) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      console.log('Attempting to connect with URI:', uri);
      await signClientRef.current.pair({ uri });
      console.log('Connection initiated successfully');
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  };

  const disconnect = async () => {
    if (!signClientRef.current || !session) {
      console.log('No session to disconnect');
      return;
    }

    try {
      console.log('Disconnecting session:', session.topic);
      await signClientRef.current.disconnect({
        topic: session.topic,
        reason: getSdkError('USER_DISCONNECTED')
      });
      setSession(null);
      setIsConnected(false);
      setShowRequestModal(false);
      setCurrentRequest(null);
      setPendingRequests([]);
      console.log('Session disconnected successfully');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      throw error;
    }
  };

  const approveSession = async (sessionProposal: any) => {
    if (!signClientRef.current) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      const { id, params } = sessionProposal;
      const { requiredNamespaces } = params;

      if (!walletAddress) {
        throw new Error('No wallet address available for session approval');
      }

      // Build namespaces for approval
      const namespaces: any = {};
      
      Object.keys(requiredNamespaces).forEach(key => {
        const accounts = [`eip155:1:${walletAddress}`];
        
        namespaces[key] = {
          accounts,
          methods: requiredNamespaces[key].methods || [],
          events: requiredNamespaces[key].events || []
        };
      });

      await signClientRef.current.approve({
        id,
        namespaces
      });

      setPendingSession(null);
      console.log('Session approved successfully');
    } catch (error) {
      console.error('Failed to approve session:', error);
      throw error;
    }
  };

  const rejectSession = async (sessionProposal: any) => {
    if (!signClientRef.current) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      await signClientRef.current.reject({
        id: sessionProposal.id,
        reason: getSdkError('USER_REJECTED')
      });
      setPendingSession(null);
    } catch (error) {
      console.error('Failed to reject session:', error);
      throw error;
    }
  };

  const approveRequest = async (request: any) => {
    await processWalletConnectRequest(request);
  };

  const rejectRequest = async (request: any) => {
    if (!signClientRef.current) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      await signClientRef.current.respond({
        topic: request.topic,
        response: {
          id: request.id,
          jsonrpc: '2.0',
          error: {
            code: 4001,
            message: 'User rejected the request'
          }
        }
      });

      setPendingRequests(prev => prev.filter(req => req.id !== request.id));
      console.log('Request rejected successfully');
    } catch (error) {
      console.error('Failed to reject request:', error);
      throw error;
    }
  };

  const checkAndRestoreSessions = async (): Promise<boolean> => {
    if (!signClientRef.current) return false;
    return await sessionManager.checkAndRestoreSessions(signClientRef.current);
  };

  const value: WalletConnectContextType = {
    isConnected,
    session,
    connect,
    disconnect,
    approveSession,
    rejectSession,
    approveRequest,
    rejectRequest,
    pendingSession,
    pendingRequests,
    checkAndRestoreSessions,
  };

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
    </WalletConnectContext.Provider>
  );
}
