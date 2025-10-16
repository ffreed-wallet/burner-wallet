import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, AlertTriangle, Check } from 'lucide-react';

interface ChainSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  chainInfo: {
    chainId: string;
    chainName: string;
    rpcUrls?: string[];
    blockExplorerUrls?: string[];
    nativeCurrency?: {
      name: string;
      symbol: string;
      decimals: number;
    };
  };
  isAddingChain?: boolean;
  isProcessing?: boolean;
}

export default function ChainSwitchModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  chainInfo,
  isAddingChain = false,
  isProcessing = false
}: ChainSwitchModalProps) {
  const formatChainId = (chainId: string) => {
    if (chainId.startsWith('0x')) {
      return parseInt(chainId, 16).toString();
    }
    return chainId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAddingChain ? (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span>Add New Chain</span>
              </>
            ) : (
              <>
                <Check className="h-5 w-5 text-blue-600" />
                <span>Switch Chain</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAddingChain 
              ? 'A dApp is requesting to add a new blockchain network to your wallet.'
              : 'A dApp is requesting to switch to a different blockchain network.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Network Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{chainInfo.chainName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chain ID:</span>
                  <Badge variant="outline">{formatChainId(chainInfo.chainId)}</Badge>
                </div>
                {chainInfo.nativeCurrency && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency:</span>
                    <span>{chainInfo.nativeCurrency.name} ({chainInfo.nativeCurrency.symbol})</span>
                  </div>
                )}
                {chainInfo.rpcUrls && chainInfo.rpcUrls.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">RPC URLs:</span>
                    <div className="text-xs font-mono bg-muted p-2 rounded max-h-20 overflow-y-auto">
                      {chainInfo.rpcUrls.map((url, index) => (
                        <div key={index}>{url}</div>
                      ))}
                    </div>
                  </div>
                )}
                {chainInfo.blockExplorerUrls && chainInfo.blockExplorerUrls.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Explorer:</span>
                    <div className="text-xs font-mono bg-muted p-2 rounded max-h-20 overflow-y-auto">
                      {chainInfo.blockExplorerUrls.map((url, index) => (
                        <div key={index} className="flex items-center gap-1">
                          <span>{url}</span>
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isAddingChain && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                This will add a new blockchain network to your wallet. Make sure you trust this dApp.
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={onReject} 
              variant="outline" 
              className="flex-1"
              disabled={isProcessing}
            >
              Reject
            </Button>
            <Button 
              onClick={onApprove} 
              className="flex-1"
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : (isAddingChain ? 'Add Chain' : 'Switch Chain')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
