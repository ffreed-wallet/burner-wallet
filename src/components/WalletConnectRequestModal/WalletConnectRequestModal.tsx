import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Check, X, AlertTriangle, ExternalLink, Plus } from 'lucide-react';
import AddCustomChainModal from '../AddCustomChainModal/AddCustomChainModal';
import { chains, testnetChains } from '@/chainConfig';

interface WalletConnectRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  request: {
    id: string;
    method: string;
    params: any[];
    dAppName?: string;
    dAppUrl?: string;
    dAppIcon?: string;
  };
  isProcessing?: boolean;
  accountAddress?: string;
  chainName?: string;
  chainIdHex?: string;
  chainIconUrl?: string;
}

export default function WalletConnectRequestModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  request,
  isProcessing = false,
  accountAddress,
  chainName,
  chainIdHex,
  chainIconUrl
}: WalletConnectRequestModalProps) {

  const getMethodDisplayName = (method: string) => {
    switch (method) {
      case 'eth_sendTransaction':
        return 'Send Transaction';
      case 'eth_sign':
      case 'personal_sign':
        return 'Sign Message';
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return 'Sign Typed Data';
      case 'eth_requestAccounts':
        return 'Request Accounts';
      case 'eth_accounts':
        return 'Get Accounts';
      case 'eth_getBalance':
        return 'Get Balance';
      case 'wallet_switchEthereumChain':
        return 'Switch Chain';
      case 'wallet_addEthereumChain':
        return 'Add Chain';
      default:
        return method;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'eth_sendTransaction':
        return '📤';
      case 'eth_sign':
      case 'personal_sign':
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return '✍️';
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return '👤';
      case 'eth_getBalance':
        return '💰';
      case 'wallet_switchEthereumChain':
        return '🔄';
      case 'wallet_addEthereumChain':
        return '➕';
      default:
        return '🔗';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'eth_sendTransaction':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'eth_sign':
      case 'personal_sign':
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'eth_getBalance':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'wallet_switchEthereumChain':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'wallet_addEthereumChain':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatTransactionData = (params: any[]) => {
    if (request.method === 'eth_sendTransaction' && params[0]) {
      const tx = params[0];
      return {
        to: tx.to,
        value: tx.value ? `${parseInt(tx.value, 16) / 1e18} ETH` : '0 ETH',
        gas: tx.gas ? parseInt(tx.gas, 16).toString() : 'Unknown',
        gasPrice: tx.gasPrice ? `${parseInt(tx.gasPrice, 16) / 1e9} Gwei` : 'Unknown',
        data: tx.data || '0x'
      };
    }
    return null;
  };

  const formatMessageData = (params: any[]) => {
    if ((request.method === 'personal_sign' || request.method === 'eth_sign') && params[0]) {
      try {
        // Try to decode hex message
        const message = params[0];
        if (message.startsWith('0x')) {
          const decoded = Buffer.from(message.slice(2), 'hex').toString('utf8');
          return decoded;
        }
        return message;
      } catch {
        return params[0];
      }
    }
    return null;
  };

  const formatTypedData = (params: any[]) => {
    if ((request.method === 'eth_signTypedData' || request.method === 'eth_signTypedData_v4') && params[1]) {
      try {
        return JSON.parse(params[1]);
      } catch {
        return params[1];
      }
    }
    return null;
  };

  const formatChainSwitchData = (params: any[]) => {
    if (request.method === 'wallet_switchEthereumChain' && params[0]) {
      const chainId = params[0].chainId;
      return {
        chainId: chainId,
        chainIdDecimal: chainId.startsWith('0x') ? parseInt(chainId, 16).toString() : chainId
      };
    }
    return null;
  };

  // Helper function to check if chain exists in app configuration
  const getChainInfo = (chainId: string) => {
    const allChains = [...chains, ...testnetChains];
    return allChains.find(chain => chain.chainId === chainId) || null;
  };

  const transactionData = formatTransactionData(request.params);
  const messageData = formatMessageData(request.params);
  const typedData = formatTypedData(request.params);
  const chainSwitchData = formatChainSwitchData(request.params);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[85vh] overflow-hidden mx-auto min-w-0 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{getMethodIcon(request.method)}</span>
            <span className="truncate">{getMethodDisplayName(request.method)}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMethodColor(request.method)}`}>
              <span className="truncate">{request.method}</span>
            </span>
          </DialogTitle>
          <DialogDescription>
            {request.dAppName ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0">Request from</span>
                {request.dAppIcon && (
                  <img 
                    src={request.dAppIcon} 
                    alt={request.dAppName}
                    className="w-4 h-4 rounded flex-shrink-0"
                  />
                )}
                <span className="font-medium truncate min-w-0">{request.dAppName}</span>
                {request.dAppUrl && (
                  <a 
                    href={request.dAppUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              'WalletConnect request'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0 flex-1 overflow-y-auto break-words">
          {/* Account / Chain */}
          {(accountAddress || chainName) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Account</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground flex-shrink-0">Wallet:</span>
                    <span className="font-mono text-xs truncate text-foreground">{accountAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground flex-shrink-0">Chain:</span>
                    {chainIconUrl && <img src={chainIconUrl} alt={chainName} className="w-4 h-4 rounded flex-shrink-0" />}
                    <span className="truncate">
                      {chainName}
                      {chainIdHex ? ` (${chainIdHex})` : ''}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Details */}
          {transactionData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Transaction Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs">To:</span>
                    <span className="font-mono text-xs break-all min-w-0 overflow-hidden">{transactionData.to}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Value:</span>
                    <span className="font-medium text-right">{transactionData.value}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Gas Limit:</span>
                    <span className="text-right">{transactionData.gas}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Gas Price:</span>
                    <span className="text-right">{transactionData.gasPrice}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Message Details */}
          {messageData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Message to Sign</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-muted p-3 rounded text-sm font-mono break-words max-h-32 overflow-y-auto min-w-0">
                  {messageData}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Typed Data Details */}
          {typedData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Typed Data to Sign</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-muted p-3 rounded text-sm font-mono break-words max-h-32 overflow-y-auto min-w-0">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(typedData, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chain Switch Details */}
          {chainSwitchData && (() => {
            const chainInfo = getChainInfo(chainSwitchData.chainId);
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Switch to Chain</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {chainInfo ? (
                      // Chain exists in app configuration
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          {chainInfo.logo && (
                            <img 
                              src={chainInfo.logo} 
                              alt={chainInfo.displayName}
                              className="w-8 h-8 rounded"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-green-800 dark:text-green-200">
                              {chainInfo.displayName}
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400">
                              Chain ID: {chainSwitchData.chainId} ({chainSwitchData.chainIdDecimal})
                            </div>
                          </div>
                          <div className="text-green-600 dark:text-green-400">
                            ✓
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          This chain is already configured in your wallet
                        </div>
                      </div>
                    ) : (
                      // Chain doesn't exist in app configuration
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="w-8 h-8 rounded bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center">
                            <span className="text-yellow-600 dark:text-yellow-400 text-sm">?</span>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-yellow-800 dark:text-yellow-200">
                              Unknown Chain
                            </div>
                            <div className="text-xs text-yellow-600 dark:text-yellow-400">
                              Chain ID: {chainSwitchData.chainId} ({chainSwitchData.chainIdDecimal})
                            </div>
                          </div>
                          <div className="text-yellow-600 dark:text-yellow-400">
                            ⚠️
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-center mb-3">
                          This chain is not configured in your wallet. You may need to add it first.
                        </div>
                        <AddCustomChainModal>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Chain
                          </Button>
                        </AddCustomChainModal>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}


          {/* Warning for signing operations */}
          {(request.method === 'eth_sign' ||
            request.method === 'personal_sign' || 
            request.method === 'eth_signTypedData' || 
            request.method === 'eth_signTypedData_v4' ||
            request.method === 'eth_sendTransaction') && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">Review carefully before signing</p>
                <p className="text-xs mt-1">
                  This action will be recorded on the blockchain and cannot be undone.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isProcessing}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={onApprove}
            disabled={isProcessing}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Approve'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
