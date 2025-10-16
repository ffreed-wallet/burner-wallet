import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Check, X, AlertTriangle, ExternalLink, Globe, Shield, Users } from 'lucide-react';

interface WalletConnectConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  sessionProposal: {
    id: number;
    params: {
      id: number;
      proposer: {
        metadata: {
          name: string;
          description: string;
          url: string;
          icons: string[];
        };
        publicKey: string;
      };
      requiredNamespaces: any;
      optionalNamespaces: any;
      sessionProperties?: any;
      relays: any[];
    };
  };
  isProcessing?: boolean;
  accountAddress?: string;
  chainName?: string;
  chainIdHex?: string;
  chainIconUrl?: string;
}

export default function WalletConnectConnectionModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  sessionProposal,
  isProcessing = false,
  accountAddress,
  chainName,
  chainIdHex,
  chainIconUrl
}: WalletConnectConnectionModalProps) {

  if (!sessionProposal) return null;

  const { proposer, requiredNamespaces, optionalNamespaces } = sessionProposal.params;
  const dAppName = proposer.metadata.name;
  const dAppDescription = proposer.metadata.description;
  const dAppUrl = proposer.metadata.url;
  const dAppIcon = proposer.metadata.icons?.[0];

  // Extract requested chains
  const requestedChains = requiredNamespaces?.eip155?.chains || [];
  const requestedMethods = requiredNamespaces?.eip155?.methods || [];
  const requestedEvents = requiredNamespaces?.eip155?.events || [];

  const formatChainId = (chainId: string) => {
    const id = parseInt(chainId.split(':')[1]);
    const chainNames: { [key: number]: string } = {
      1: 'Ethereum',
      8453: 'Base',
      137: 'Polygon',
      56: 'BSC',
      10: 'Optimism'
    };
    return chainNames[id] || `Chain ${id}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Connection Request
          </DialogTitle>
          <DialogDescription>
            A dApp wants to connect to your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* dApp Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {dAppIcon ? (
                    <img
                      src={dAppIcon}
                      alt={dAppName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="h-full w-full flex items-center justify-center text-lg font-bold text-gray-600"
                    style={{ display: dAppIcon ? 'none' : 'flex' }}
                  >
                    {dAppName?.slice(0, 2).toUpperCase() || '?'}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{dAppName}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{dAppDescription}</p>
                  {dAppUrl && (
                    <a 
                      href={dAppUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {new URL(dAppUrl).hostname}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          {accountAddress && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm">
                  <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 dark:text-gray-200 p-2 rounded break-all">
                    {accountAddress}
                  </div>
                  {chainName && (
                    <div className="mt-2 text-gray-600 dark:text-gray-300">
                      Connected to: {chainName}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}



          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <div className="font-medium">Security Notice</div>
              <div className="text-xs mt-1">
                Only connect to trusted dApps. This will allow the dApp to view your account balance and request transactions.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
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
              {isProcessing ? 'Connecting...' : 'Approve'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
