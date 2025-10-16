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
  sessions: SessionTypes.Struct[];
  connect: (uri: string) => Promise<void>;
  disconnect: () => Promise<void>;
  disconnectSession: (topic: string) => Promise<void>;
  approveSession: (sessionProposal: any) => Promise<void>;
  rejectSession: (sessionProposal: any) => Promise<void>;
  approveRequest: (request: any, pin?: string) => Promise<void>;
  rejectRequest: (request: any) => Promise<void>;
  pendingSession: any | null;
  pendingRequests: any[];
  checkAndRestoreSessions: () => Promise<boolean>;
  showPinPrompt: boolean;
  pinPromptTitle: string;
  pinPromptDescription: string;
  showConnectionModal: boolean;
  setShowConnectionModal: (show: boolean) => void;
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
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [pendingSession, setPendingSession] = useState<any | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinPromptTitle, setPinPromptTitle] = useState('');
  const [pinPromptDescription, setPinPromptDescription] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [deferredRequests, setDeferredRequests] = useState<any[]>([]);
  const signClientRef = useRef<any>(null);
  
  // Get the actual wallet address from LibBurner
  const { walletAddress, burner, getGasTokenBalance, isConnected: libBurnerConnected } = useLibBurner();
  const { selectedChain, setSelectedChain, knownChains, addCustomChain, isInitialized } = useChain();

  // Debug selectedChain changes
  useEffect(() => {
    console.log('WalletConnectProvider selectedChain updated:', {
      chainId: selectedChain?.chainId,
      displayName: selectedChain?.displayName
    });
  }, [selectedChain]);

  // Process deferred requests when ChainProvider is initialized
  useEffect(() => {
    if (isInitialized && deferredRequests.length > 0) {
      console.log('Processing deferred requests:', deferredRequests.length);
      deferredRequests.forEach(request => {
        handleSessionRequest(request);
      });
      setDeferredRequests([]);
    }
  }, [isInitialized, deferredRequests]);

  // Initialize managers
  const sessionManager = new WalletConnectSessionManager(session, isConnected, setSession, setIsConnected);
  const requestProcessor = new WalletConnectRequestProcessor();
  const chainHandler = new WalletConnectChainHandler();

  // Update sessions list
  const updateSessionsList = () => {
    if (signClientRef.current) {
      try {
        const allSessions = signClientRef.current.session.getAll();
        setSessions(allSessions);
        console.log('Updated sessions list:', allSessions.length, 'sessions');
      } catch (error) {
        console.error('Error updating sessions list:', error);
      }
    }
  };

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

  // Ensure dApps know our active chain whenever session becomes available or chain changes
  useEffect(() => {
    const emit = async () => {
      if (session) {
        try {
          console.log('Emitting chain change event for manual switch:', selectedChain.displayName, selectedChain.chainId);
          await chainHandler.emitChainChangeEvent(selectedChain.chainId, session, signClientRef.current);
          console.log('Chain change event emitted successfully for manual switch');
        } catch (e) {
          console.warn('Failed to emit chainChanged on manual switch:', e);
        }
      } else {
        console.log('No WalletConnect session available for chain change event');
      }
    };
    emit();
  }, [session, selectedChain.chainId]);

  const initializeWalletConnect = async () => {
    try {
      const signClient = await SignClient.init({
        projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID, // Replace with actual project ID
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
      
      // Update sessions list
      updateSessionsList();
      
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
      setShowConnectionModal(true);
    });

    // Session request listener
    signClient.on('session_request', (event: any) => {
      console.log('Session request received:', event);
      handleSessionRequest(event);
    });

    // Session delete listener
    signClient.on('session_delete', (event: any) => {
      console.log('Session deleted:', event);
      sessionManager.handleSessionDelete();
      setShowRequestModal(false);
      setShowConnectionModal(false);
      setCurrentRequest(null);
      setPendingRequests([]);
      updateSessionsList();
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
      isConnected: isConnected,
      isInitialized,
      selectedChainId: selectedChain?.chainId
    });

    // Wait for ChainProvider to initialize before processing requests
    if (!isInitialized) {
      console.log('ChainProvider not initialized yet, deferring request processing');
      // Queue the request for later processing
      setDeferredRequests(prev => [...prev, event]);
      return;
    }
    
    const method = event?.params?.request?.method;
    const interactiveMethods = [
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v4',
      'eth_sendTransaction',
      'wallet_switchEthereumChain',
    ];

    // If the request specifies a chainId and it doesn't match our active chain, prompt a chain switch first
    try {
      const reqChain = event?.params?.chainId as string | undefined; // e.g. 'eip155:1'
      if (reqChain && typeof reqChain === 'string') {
        const parts = reqChain.split(':');
        const reqDec = parts.length > 1 ? parts[1] : undefined;
        const currentDec = parseInt(selectedChain.chainId, 16).toString();
        
        console.log('Chain mismatch check debug:', {
          reqChain,
          reqDec,
          selectedChainId: selectedChain.chainId,
          selectedChainName: selectedChain.displayName,
          currentDec,
          isMismatch: reqDec && reqDec !== currentDec
        });
        
        if (reqDec && reqDec !== currentDec) {
          console.log('Chain mismatch detected. Queuing chain switch before processing request:', { reqChain, currentChainHex: selectedChain.chainId });
          // Build a synthetic wallet_switchEthereumChain request
          const targetHex = `0x${parseInt(reqDec, 10).toString(16)}`;
          const switchReq = {
            id: `${event.id}-switch`,
            topic: event.topic,
            params: {
              request: {
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetHex }],
              }
            },
            __synthetic: true
          };

          setPendingRequests(prev => {
            const existsSwitch = prev.some(r => r.id === switchReq.id);
            const existsOrig = prev.some(r => r.id === event.id);
            const next = existsSwitch ? prev : [...prev, switchReq];
            return existsOrig ? next : [...next, event];
          });
          setShowRequestModal(true);
          return; // do not process original request yet
        }
      }
    } catch (e) {
      console.warn('Failed to parse request chainId for mismatch handling:', e);
    }

    // If interactive method (signing, transactions, etc.), always require user approval via pending list
    if (interactiveMethods.includes(method)) {
      // Special handling for wallet_switchEthereumChain - check if already on requested chain
      if (method === 'wallet_switchEthereumChain') {
        const requestedChainId = event?.params?.request?.params?.[0]?.chainId;
        const currentChainId = selectedChain?.chainId;
        
        console.log('Chain comparison debug:', {
          requestedChainId,
          currentChainId,
          requestedType: typeof requestedChainId,
          currentType: typeof currentChainId,
          exactMatch: requestedChainId === currentChainId
        });
        
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
        
        const normalizedRequested = normalizeChainId(requestedChainId);
        const normalizedCurrent = normalizeChainId(currentChainId);
        
        console.log('Normalized chain IDs:', {
          normalizedRequested,
          normalizedCurrent,
          normalizedMatch: normalizedRequested === normalizedCurrent
        });
        
        if (normalizedRequested && normalizedCurrent && normalizedRequested === normalizedCurrent) {
          console.log('Already on requested chain, processing directly without modal:', requestedChainId);
          try {
            // Process the request directly without showing modal
            await processWalletConnectRequest(event);
            return;
          } catch (error) {
            console.error('Error processing same-chain switch request:', error);
            await sendErrorResponse(event, error);
            return;
          }
        }
      }
      
      console.log('Queueing interactive request for user approval:', method);
      setPendingRequests(prev => {
        const exists = prev.some(r => r.id === event.id);
        const newRequests = exists ? prev : [...prev, event];
        console.log('Updated pending requests:', newRequests.length, 'requests');
        return newRequests;
      });
      setShowRequestModal(true);
      console.log('Set showRequestModal to true - RETURNING EARLY');
      return; // This should prevent further processing
    }

    // Check if this is a request to a non-existent session
    if (!session || session.topic !== event.topic) {
      console.warn('Request received for non-existent or mismatched session:', {
        requestTopic: event.topic,
        sessionTopic: session?.topic,
        hasSession: !!session
      });
      
      // For sessionless methods, we can still process them
      const sessionlessMethods = ['wallet_getCapabilities', 'wallet_addEthereumChain'];
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
        // Avoid duplicates by id
        setPendingRequests(prev => {
          const exists = prev.some(r => r.id === event.id);
          return exists ? prev : [...prev, event];
        });
        setShowRequestModal(true);
      }
    } else {
      // For non-interactive methods, process immediately for active session
      console.log('Processing non-interactive method for active session:', method);
      setCurrentRequest(event);
      try {
        await processWalletConnectRequest(event);
      } catch (error) {
        console.error('Error processing request:', error);
        await sendErrorResponse(event, error);
      }
    }
  };

  const processWalletConnectRequest = async (request: any, keyPassword?: string) => {
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

    let deferResponse = false;
    try {
      // Do not auto-process chain switch here; it is queued & approved interactively

      const result = await requestProcessor.processRequest(
        request,
        session,
        walletAddress,
        libBurnerConnected,
        burner,
        selectedChain,
        setSelectedChain,
        (chainId: string) => chainHandler.emitChainChangeEvent(chainId, session, signClientRef.current),
        keyPassword
      );

      // Send success response (skip for synthetic local prompts)
      if (!(request as any)?.__synthetic && !(typeof request.id === 'string' && `${request.id}`.includes('-switch'))) {
        await sendSuccessResponse(request, result);
      }
      // Always remove from pending after processing
      setPendingRequests(prev => prev.filter(req => req.id !== request.id));
    } catch (error) {
      console.error('Error processing request:', error);
      // Determine if this is an interactive method with a recoverable error
      const method = request?.params?.request?.method || '';
      const interactiveMethods = [
        'eth_sign',
        'personal_sign',
        'eth_signTypedData',
        'eth_signTypedData_v4',
        'eth_sendTransaction',
        'wallet_switchEthereumChain',
      ];
      const message = (error as any)?.message || '';
      const isInteractive = interactiveMethods.includes(method);
      const isRecoverable = typeof message === 'string' && (
        message.includes('tap your card') ||
        message.includes('Missing burner data') ||
        message.includes('Wrong password') ||
        message.includes('ERROR_CODE_WRONG_PWD')
      );

      if (isInteractive && isRecoverable) {
        // Keep request pending, show prompt, and do NOT send a response yet
        deferResponse = true;
        if (message.includes('Missing burner data')) {
          setPinPromptTitle('Tap your burner card');
          setPinPromptDescription('Please tap your burner card to provide the missing data.');
        } else {
          setPinPromptTitle('Tap your card');
          setPinPromptDescription('Please tap your card to authorize the action.');
        }
        setShowPinPrompt(true);
        setPendingRequests(prev => {
          const exists = prev.some(r => r.id === request.id);
          return exists ? prev : [...prev, request];
        });
      } else {
        if (!(request as any)?.__synthetic && !(typeof request.id === 'string' && `${request.id}`.includes('-switch'))) {
          await sendErrorResponse(request, error);
        }
        // Ensure it doesn't stick around
        setPendingRequests(prev => prev.filter(req => req.id !== request.id));
      }
    } finally {
      setIsProcessingRequest(false);
      if (!deferResponse) {
        setCurrentRequest(null);
        // Keep prompt visible briefly; hide after response is sent
        setTimeout(() => setShowPinPrompt(false), 1500);
      }
    }
  };

  const sendSuccessResponse = async (request: any, result: any) => {
    const debugData = {
      method: request?.params?.request?.method,
      result,
      resultType: typeof result,
      isString: typeof result === 'string'
    };
    
    // Ensure proper JSON-RPC 2.0 format as per WalletConnect specs
    const formattedResponse = {
      jsonrpc: "2.0",
      id: request.id,
      result: result
    };
    
    const response = {
      topic: request.topic,
      response: formattedResponse
    } as any;


    try {
      await signClientRef.current.respond(response);
    } catch (respondError) {
      console.error('Error sending response to dApp:', respondError);
    } finally {
      // Clean up the request from pending list regardless
      setPendingRequests(prev => prev.filter(req => req.id !== request.id));
    }
  };

  const sendErrorResponse = async (request: any, error: any) => {
    const errorCode = (error as any)?.code || -32000;
    const errorMessage = (error as any)?.message || (error instanceof Error ? error.message : 'Unknown error');
    
    // Ensure proper JSON-RPC 2.0 error format as per WalletConnect specs
    const errorResponse = {
      topic: request.topic,
      response: {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: errorCode,
          message: errorMessage
        }
      }
    } as any;

    try {
      await signClientRef.current.respond(errorResponse);
    } catch (respondError) {
      console.error('Failed to send error response:', respondError);
    } finally {
      setPendingRequests(prev => prev.filter(req => req.id !== request.id));
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
      updateSessionsList();
      console.log('Session disconnected successfully');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      throw error;
    }
  };

  const disconnectSession = async (topic: string) => {
    if (!signClientRef.current) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      console.log('Disconnecting session:', topic);
      await signClientRef.current.disconnect({
        topic,
        reason: getSdkError('USER_DISCONNECTED')
      });
      
      // If this was the active session, clear it
      if (session && session.topic === topic) {
        setSession(null);
        setIsConnected(false);
        setShowRequestModal(false);
        setCurrentRequest(null);
        setPendingRequests([]);
      }
      
      updateSessionsList();
      console.log('Session disconnected successfully');
    } catch (error) {
      console.error('Failed to disconnect session:', error);
      throw error;
    }
  };

  const approveSession = async (sessionProposal: any) => {
    if (!signClientRef.current) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      const { id, params } = sessionProposal;
      const { requiredNamespaces, optionalNamespaces } = params;

      console.log('Session proposal details:', {
        id,
        requiredNamespaces,
        walletAddress
      });

      if (!walletAddress) {
        throw new Error('No wallet address available for session approval');
      }

      if (!requiredNamespaces || typeof requiredNamespaces !== 'object') {
        throw new Error('Invalid or missing requiredNamespaces in session proposal');
      }

      // Merge required and optional namespaces (required takes precedence)
      const requestedNamespaces: Record<string, any> = {
        ...(optionalNamespaces || {}),
        ...requiredNamespaces,
      };

      // Build namespaces for approval
      const namespaces: Record<string, { accounts: string[]; methods: string[]; events: string[]; chains?: string[] }> = {};

      // Our wallet's supported EVM methods and events
      const supportedMethods = [
        'eth_accounts',
        'eth_chainId',
        'eth_requestAccounts',
        'eth_getBalance',
        'eth_getTransactionCount',
        'eth_sendTransaction',
        'eth_sign',
        'personal_sign',
        'eth_signTypedData',
        'eth_signTypedData_v4',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain'
      ];
      const supportedEvents = ['accountsChanged', 'chainChanged'];

      // Supported chains set (decimal) from chainConfig
      const supportedDecChainIds = (() => {
        try {
          const { chains } = require('../chainConfig');
          return chains.map((c: any) => parseInt(c.chainId, 16).toString());
        } catch {
          return ['1', '8453', '137', '56', '10'];
        }
      })();

      Object.keys(requestedNamespaces).forEach(key => {
        const ns = requestedNamespaces[key];
        if (!ns || typeof ns !== 'object') {
          console.warn(`Invalid namespace for key ${key}:`, ns);
          return;
        }

        let chains: string[] = Array.isArray(ns.chains) ? ns.chains : [];
        // Filter to supported chains only
        chains = chains.filter((c) => {
          const parts = `${c}`.split(':');
          const dec = parts[1];
          return supportedDecChainIds.includes(dec);
        });

        // Build accounts for all requested chains; fallback to selectedChain for eip155 if none provided
        let accounts: string[] = [];
        if (chains.length > 0) {
          accounts = chains.map(chainIdWithPrefix => `${chainIdWithPrefix}:${walletAddress}`);
        } else if (key === 'eip155') {
          const decChainId = parseInt(selectedChain.chainId, 16).toString();
          accounts = [`eip155:${decChainId}:${walletAddress}`];
        }

        if (accounts.length === 0) {
          console.warn(`No chains provided for namespace ${key} and no fallback available.`);
          return;
        }

        const mergedMethods = Array.from(new Set([...(ns.methods || []), ...supportedMethods]));
        const mergedEvents = Array.from(new Set([...(ns.events || []), ...supportedEvents]));

        namespaces[key] = {
          accounts,
          methods: mergedMethods,
          events: mergedEvents,
          // Include chains to help dApps using WC Cloud provider align to supported networks
          chains: accounts.map(a => a.split(':').slice(0,2).join(':'))
        };
      });

      console.log('Constructed namespaces for approval:', namespaces);

      if (Object.keys(namespaces).length === 0) {
        throw new Error('No valid namespaces found for session approval');
      }

      const { acknowledged, topic } = await signClientRef.current.approve({
        id,
        namespaces
      });

      // Wait until the dApp acknowledges
      await acknowledged();

      // Retrieve and set the active session so we can respond to requests correctly
      try {
        const activeSession = signClientRef.current.session.get(topic);
        setSession(activeSession);
        setIsConnected(true);
        console.log('Active session set:', {
          topic: activeSession.topic,
          accounts: activeSession.namespaces?.eip155?.accounts,
        });
        // Proactively emit our active chain so dApp switches away from unsupported chains
        try {
          await chainHandler.emitChainChangeEvent(selectedChain.chainId, activeSession, signClientRef.current);
          const activeAccounts = activeSession.namespaces?.eip155?.accounts || [];
          await chainHandler.emitAccountsChangeEvent(activeAccounts.map((a: string) => a.split(':')[2]), activeSession, signClientRef.current, selectedChain.chainId);
        } catch (e) {
          console.warn('Failed to emit chainChanged right after approve:', e);
        }
      } catch (e) {
        console.warn('Approved but could not retrieve session immediately, will rely on restore:', e);
      }

      setPendingSession(null);
      setShowConnectionModal(false);
      updateSessionsList();
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
      setShowConnectionModal(false);
    } catch (error) {
      console.error('Failed to reject session:', error);
      throw error;
    }
  };

  const approveRequest = async (request: any, pin?: string) => {
    // Ensure we have an active session before processing
    if (!session || !isConnected) {
      console.log('No active session, attempting to restore...');
      const restored = await checkAndRestoreSessions();
      if (!restored) {
        throw new Error('No active WalletConnect session available');
      }
    }

    // Ensure burner data is initialized before setting password (skip for chain switch)
    const method = request?.params?.request?.method || '';
    const needsBurnerData = !['wallet_switchEthereumChain', 'wallet_addEthereumChain'].includes(method);
    
    if (needsBurnerData) {
      try {
        if (burner && typeof (burner as any).getData === 'function') {
          await (burner as any).getData();
        }
      } catch (e) {
        console.warn('Failed to initialize burner data:', e);
        setPinPromptTitle('Tap your card');
        setPinPromptDescription('Please tap your card to unlock your wallet.');
        setShowPinPrompt(true);
        throw e;
      }
    }

    // If a PIN is supplied, set it on the burner before processing
    try {
      if (pin && burner && typeof (burner as any).setPassword === 'function') {
        (burner as any).setPassword(pin);
      }
    } catch (e) {
      console.warn('Failed to set burner password:', e);
      throw e;
    }

    await processWalletConnectRequest(request, pin);
  };

  // Expose a helper to add/switch to a custom chain based on hex chainId
  const ensureChainExistsAndSelect = (hexChainId: string) => {
    const dec = parseInt(hexChainId, 16);
    const exists = knownChains.some(c => parseInt(c.chainId, 16) === dec);
    if (!exists) {
      const chain: any = {
        chainId: hexChainId,
        displayName: `Chain ${dec}`,
        rpcUrl: `https://rpc.walletconnect.com/v1?chainId=eip155:${dec}`,
      };
      addCustomChain(chain);
    }
    const found = exists ? knownChains.find(c => parseInt(c.chainId, 16) === dec)! : {
      chainId: hexChainId,
      displayName: `Chain ${dec}`,
      rpcUrl: `https://rpc.walletconnect.com/v1?chainId=eip155:${dec}`,
    } as any;
    setSelectedChain(found);
  };

  const rejectRequest = async (request: any) => {
    if (!signClientRef.current) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      // Skip sending response for synthetic requests (they don't have real topics)
      if (!(request as any)?.__synthetic && !(typeof request.id === 'string' && `${request.id}`.includes('-switch'))) {
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
      }

      // Always remove from pending after rejection
      // Add a small delay to ensure modal state updates properly
      setTimeout(() => {
        setPendingRequests(prev => prev.filter(req => req.id !== request.id));
        console.log('Request rejected successfully');
      }, 100);
    } catch (error) {
      console.error('Failed to reject request:', error);
      // Still remove from pending even if response failed
      setPendingRequests(prev => prev.filter(req => req.id !== request.id));
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
    sessions,
    connect,
    disconnect,
    disconnectSession,
    approveSession,
    rejectSession,
    approveRequest,
    rejectRequest,
    pendingSession,
    pendingRequests,
    checkAndRestoreSessions,
    showPinPrompt,
    pinPromptTitle,
    pinPromptDescription,
    showConnectionModal,
    setShowConnectionModal,
  };

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
    </WalletConnectContext.Provider>
  );
}
