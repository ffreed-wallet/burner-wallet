import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWalletConnect } from '@/providers/WalletConnectProvider';
import { useLibBurner } from '@/providers/LibBurnerProvider';
import { useChain } from '@/providers/ChainProvider';
import { Wallet, X, Check, AlertCircle, Plus, ExternalLink, Trash2, Clock } from 'lucide-react';
import PinInput from '@/components/PinInput/PinInput';
import WalletConnectRequestModal from '@/components/WalletConnectRequestModal/WalletConnectRequestModal';
import WalletConnectConnectionModal from '@/components/WalletConnectConnectionModal/WalletConnectConnectionModal';
import { toast } from 'sonner';
import { chains, testnetChains } from '@/chainConfig';

interface WalletConnectModalProps {
  children?: React.ReactNode;
}

export default function WalletConnectModal({ children }: WalletConnectModalProps) {
  const [open, setOpen] = useState(false);
  const [connectionUri, setConnectionUri] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinRequest, setPinRequest] = useState<any | null>(null);
  
  const { 
    isConnected, 
    session, 
    sessions,
    connect, 
    disconnect, 
    disconnectSession,
    approveSession, 
    rejectSession,
    pendingSession,
    pendingRequests,
    approveRequest,
    rejectRequest,
    showPinPrompt,
    pinPromptTitle,
    pinPromptDescription,
    showConnectionModal,
    setShowConnectionModal
  } = useWalletConnect();
  
  const { walletAddress, isConnected: libBurnerConnected } = useLibBurner();
  const { selectedChain, availableChains } = useChain();

  // Helper function to get chain info from chainId
  const getChainInfoFromId = (chainId: string) => {
    const allChains = [...chains, ...testnetChains, ...availableChains];
    return allChains.find(chain => chain.chainId === chainId) || null;
  };

  // Helper function to get chain info for wallet_switchEthereumChain requests
  const getRequestedChainInfo = (request: any) => {
    if (request?.params?.request?.method === 'wallet_switchEthereumChain') {
      const requestedChainId = request?.params?.request?.params?.[0]?.chainId;
      if (requestedChainId) {
        return getChainInfoFromId(requestedChainId);
      }
    }
    return null;
  };

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<any | null>(null);
  const [manuallyClosed, setManuallyClosed] = useState(false);

  const handleConnect = async () => {
    if (!connectionUri.trim()) {
      toast.error('Please enter a connection URI');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await connect(connectionUri);
      setConnectionUri('');
      setShowAddConnection(false);
      toast.success('Connected to dApp successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApproveSession = async () => {
    if (!pendingSession) return;

    try {
      console.log('Approving session:', pendingSession);
      await approveSession(pendingSession);
      toast.success('Session approved successfully');
    } catch (err) {
      console.error('Failed to approve session:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve session';
      toast.error(errorMessage);
    }
  };

  const handleRejectSession = async () => {
    if (!pendingSession) return;

    try {
      await rejectSession(pendingSession);
      toast.success('Session rejected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject session';
      toast.error(errorMessage);
    }
  };

  const handleApproveRequest = async (request: any) => {
    try {
      // Open PIN modal before processing sign/tx (wallet_switchEthereumChain doesn't need PIN)
      const method = request?.params?.request?.method || '';
      const needsPin = ['eth_sign','personal_sign','eth_signTypedData','eth_signTypedData_v4','eth_sendTransaction'].includes(method);
      if (needsPin) {
        setPinRequest(request);
        setPinOpen(true);
        return;
      }
      // For non-interactive methods, process immediately
      await approveRequest(request);
      setDetailsOpen(false);
      setDetailsRequest(null);
      setManuallyClosed(false); // Reset manual close flag since user took action
      setOpen(false);
      toast.success('Request approved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve request';
      toast.error(errorMessage);
    }
  };

  const openDetails = (request: any) => {
    setDetailsRequest(request);
    setDetailsOpen(true);
    setManuallyClosed(false); // Reset manual close flag when manually opening
  };

  const handleManualClose = () => {
    setDetailsOpen(false);
    setDetailsRequest(null);
    setManuallyClosed(true); // Set flag to prevent auto-reopening
    console.log('Modal manually closed, will not auto-open until user clicks');
  };

  // Auto-open review modal on incoming requests
  useEffect(() => {
    console.log('Auto-open effect triggered:', {
      pendingRequestsLength: pendingRequests.length,
      detailsOpen,
      pinOpen,
      manuallyClosed,
      shouldOpen: pendingRequests.length > 0 && !detailsOpen && !pinOpen && !manuallyClosed,
      firstRequestId: pendingRequests[0]?.id
    });
    if (pendingRequests.length > 0 && !detailsOpen && !pinOpen && !manuallyClosed) {
      console.log('Auto-opening modal for request:', pendingRequests[0].id);
      // Only show the request details modal, not the main modal
      setDetailsRequest(pendingRequests[0]);
      setDetailsOpen(true);
    } else if (pendingRequests.length > 0) {
      console.log('Not opening modal because:', {
        detailsOpen,
        pinOpen,
        manuallyClosed,
        reason: detailsOpen ? 'details already open' : pinOpen ? 'pin modal open' : manuallyClosed ? 'manually closed' : 'unknown'
      });
    }
  }, [pendingRequests, detailsOpen, pinOpen, manuallyClosed]);

  const handleRejectRequest = async (request: any) => {
    try {
      console.log('Rejecting request:', request.id, 'Pending requests before:', pendingRequests.length);
      await rejectRequest(request);
      setDetailsOpen(false);
      setDetailsRequest(null);
      setManuallyClosed(false); // Reset manual close flag since user took action
      console.log('Request rejected, modal closed. Pending requests after:', pendingRequests.length);
      toast.success('Request rejected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject request';
      toast.error(errorMessage);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success('Disconnected successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      toast.error(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="icon" className="h-10 w-10">
            <Wallet className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto mx-auto">
        <DialogHeader>
          <DialogTitle>WalletConnect</DialogTitle>
          <DialogDescription>
            Connect to dApps using WalletConnect protocol
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-hidden">
          {!libBurnerConnected && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-600">Please connect your LibBurner wallet first</span>
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <Tabs defaultValue="connections" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connections" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Connections ({sessions.length})
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending ({pendingRequests.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="connections" className="space-y-4 mt-4 max-h-[calc(100vh-12rem)] overflow-y-auto overflow-x-hidden">

          

          {/* Connected dApps */}
          {sessions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium flex-1 min-w-0">Connected dApps ({sessions.length})</h3>
                <Button
                  onClick={() => setShowAddConnection(!showAddConnection)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 flex-shrink-0 text-xs px-2 py-1 h-7"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">Add dApp</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
              
              {/* Add New Connection */}
              {showAddConnection && (
                <div className="space-y-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Connect to New dApp</h3>
                    <Button
                      onClick={() => setShowAddConnection(false)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div>
                    <Label htmlFor="connection-uri">Connection URI</Label>
                    <Input
                      id="connection-uri"
                      placeholder="wc:..."
                      value={connectionUri}
                      onChange={(e) => setConnectionUri(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleConnect} 
                    disabled={isConnecting || !connectionUri.trim() || !libBurnerConnected}
                    className="w-full"
                  >
                    {!libBurnerConnected ? 'Connect LibBurner First' : isConnecting ? 'Connecting...' : 'Connect to dApp'}
                  </Button>
                </div>
              )}
              
              {/* List all connected dApps */}
              <div className="space-y-2">
                {sessions.map((sessionItem) => (
                  <Card key={sessionItem.topic} className="p-3">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {sessionItem.peer.metadata.icons?.[0] ? (
                            <img
                              src={sessionItem.peer.metadata.icons[0]}
                              alt={sessionItem.peer.metadata.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                if (nextElement) {
                                  nextElement.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div 
                            className="h-full w-full flex items-center justify-center text-blue-600 dark:text-blue-400"
                            style={{ display: sessionItem.peer.metadata.icons?.[0] ? 'none' : 'flex' }}
                          >
                            <Wallet className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="font-medium text-sm truncate" title={sessionItem.peer.metadata.name}>{sessionItem.peer.metadata.name}</p>
                          <p className="text-xs text-muted-foreground truncate" title={sessionItem.peer.metadata.url}>{sessionItem.peer.metadata.url}</p>
                          {session && session.topic === sessionItem.topic && (
                            <p className="text-xs text-green-600 font-medium">Active</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(sessionItem.peer.metadata.url, '_blank')}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectSession(sessionItem.topic)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}



              {/* No Connections */}
              {sessions.length === 0 && !showAddConnection && (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No dApps connected</p>
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setShowAddConnection(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Connect to dApp
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="requests" className="space-y-4 mt-4 max-h-[calc(100vh-12rem)] overflow-y-auto overflow-x-hidden">
              {/* PIN / Card Prompt */}
              {showPinPrompt && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-blue-800 text-sm font-medium">{pinPromptTitle || 'Action Required'}</h4>
                  <p className="text-xs text-blue-700 mt-1">{pinPromptDescription || 'Please tap your card or enter PIN on your device to continue.'}</p>
                </div>
              )}

              {/* Pending Session */}
              {pendingSession && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-medium text-yellow-800 mb-2">
                    Connection Request
                  </h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    {pendingSession.params?.proposer?.metadata?.name || 'Unknown dApp'} wants to connect
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleApproveSession} 
                      size="sm"
                      className="flex-1"
                    >
                      Approve
                    </Button>
                    <Button 
                      onClick={handleRejectSession} 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Pending Requests */}
              {pendingRequests.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Pending Requests ({pendingRequests.length})</h3>
                    {manuallyClosed && (
                      <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        Click to review
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {pendingRequests.map((request, index) => (
                      <div key={`${request.id || index}-${request.params?.request?.method || 'unknown'}`} className="p-3 bg-muted border rounded-lg">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-sm font-medium truncate" title={request.params?.request?.method || 'Unknown method'}>
                              {request.params?.request?.method || 'Unknown method'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate" title={request?.params?.requester?.metadata?.name || session?.peer?.metadata?.name || 'Unknown dApp'}>
                              From: {request?.params?.requester?.metadata?.name || session?.peer?.metadata?.name || 'Unknown dApp'}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button 
                              onClick={() => handleApproveRequest(request)} 
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              Quick Approve
                            </Button>
                            <Button 
                              onClick={() => openDetails(request)} 
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              Review
                            </Button>
                            <Button 
                              onClick={() => handleRejectRequest(request)} 
                              variant="outline" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No pending requests</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* PIN Modal */}
      <PinInput 
        isOpen={pinOpen}
        onClose={() => { 
          setPinOpen(false); 
          setPinRequest(null);
          setDetailsOpen(false);
          setDetailsRequest(null);
          setOpen(false);
        }}
        onPinEntered={async (pin: string) => {
          if (!pinRequest) return;
          try {
            await approveRequest(pinRequest, pin);
            // Close both modals on success
            setDetailsOpen(false);
            setDetailsRequest(null);
            setOpen(false);
            toast.success('Request approved successfully');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process request');
            toast.error(err instanceof Error ? err.message : 'Failed to process request');
          } finally {
            setPinOpen(false);
            setPinRequest(null);
          }
        }}
        title="Enter PIN to authorize"
        description="Enter your PIN, then tap your card when prompted."
      />
      {/* Request Review Modal */}
      {detailsRequest && (
        <WalletConnectRequestModal
          isOpen={detailsOpen}
          onClose={handleManualClose}
          onApprove={() => {
            handleApproveRequest(detailsRequest);
          }}
          onReject={() => {
            handleRejectRequest(detailsRequest);
          }}
          request={{
            id: String(detailsRequest.id),
            method: detailsRequest?.params?.request?.method || 'unknown',
            params: detailsRequest?.params?.request?.params || [],
            dAppName: detailsRequest?.params?.requester?.metadata?.name || session?.peer?.metadata?.name,
            dAppUrl: detailsRequest?.params?.requester?.metadata?.url || session?.peer?.metadata?.url,
            dAppIcon: detailsRequest?.params?.requester?.metadata?.icons?.[0] || session?.peer?.metadata?.icons?.[0],
          }}
          isProcessing={false}
          accountAddress={walletAddress || session?.namespaces?.eip155?.accounts?.[0]?.split(':')?.[2]}
          chainName={(() => {
            // For wallet_switchEthereumChain, show the requested chain instead of current chain
            const requestedChain = getRequestedChainInfo(detailsRequest);
            if (requestedChain) {
              return requestedChain.displayName;
            }
            return selectedChain?.displayName;
          })()}
          chainIdHex={(() => {
            // For wallet_switchEthereumChain, show the requested chain instead of current chain
            if (detailsRequest?.params?.request?.method === 'wallet_switchEthereumChain') {
              const requestedChainId = detailsRequest?.params?.request?.params?.[0]?.chainId;
              if (requestedChainId) {
                return requestedChainId;
              }
            }
            return selectedChain?.chainId;
          })()}
          chainIconUrl={(() => {
            // For wallet_switchEthereumChain, show the requested chain instead of current chain
            const requestedChain = getRequestedChainInfo(detailsRequest);
            if (requestedChain) {
              return requestedChain.logo;
            }
            return selectedChain?.logo;
          })()}
        />
      )}

      {/* Connection Request Modal */}
      {pendingSession && (
        <WalletConnectConnectionModal
          isOpen={showConnectionModal}
          onClose={() => setShowConnectionModal(false)}
          onApprove={handleApproveSession}
          onReject={handleRejectSession}
          sessionProposal={pendingSession}
          isProcessing={false}
          accountAddress={walletAddress}
          chainName={selectedChain?.displayName}
          chainIdHex={selectedChain?.chainId}
          chainIconUrl={selectedChain?.logo}
        />
      )}
    </Dialog>
  );
}
