import React, { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar/TopBar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useLibBurner } from '@/providers/LibBurnerProvider';
import { useChain } from '@/providers/ChainProvider';
import { getAssetTransfers, AlchemyAssetTransfer } from '@/lib/alchemy';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

function prettifyAddress(address) {
	return `${address.substring(0, 6)}...${address.substring(address.length - 4, address.length)}`;
}

// { // convert into a react component that can be used in the card
// "name": "Transfer",
// "signature": "Transfer(indexed address from, indexed address to, uint256 value)",
// "params": [
//     {
//         "name": "from",
//         "type": "address",
//         "indexed": true,
//         "decoded": true,
//         "value": "0xf2849ad8e874717bab8f02840981e66f832a4959"
//     },
//     {
//         "name": "to",
//         "type": "address",
//         "indexed": true,
//         "decoded": true,
//         "value": "0x43d821addeeddaa949e438e7d97243d58c0d507b"
//     },
//     {
//         "name": "value",
//         "type": "uint256",
//         "indexed": false,
//         "decoded": true,
//         "value": "100000000000000"
//     }
// ]
// }

export default function Component() {
	const [isLoading, setIsLoading] = useState(true);
	const [transactions, setTransactions] = useState<AlchemyAssetTransfer[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const { walletAddress, isConnected } = useLibBurner();
	const { selectedChain } = useChain();
	
	const ITEMS_PER_PAGE = 10;

	// Fetch transactions when component mounts or wallet/chain changes
	useEffect(() => {
		const fetchTransactions = async () => {
			if (!walletAddress || !isConnected) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				setError(null);
				
				const response = await getAssetTransfers(
					walletAddress,
					selectedChain.chainId,
					"0x0", // fromBlock: start from genesis
					"latest", // toBlock: latest
					undefined, // maxCount: use default
					true, // excludeZeroValue: exclude zero value transfers
					["external", "erc20", "erc721", "erc1155"] // category: all categories
				);

				// Sort by block number (newest first)
				const sortedTransfers = response.transfers.sort((a, b) => 
					parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16)
				);

				setTransactions(sortedTransfers);
			} catch (err) {
				console.error('Error fetching transactions:', err);
				setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
			} finally {
				setIsLoading(false);
			}
		};

		fetchTransactions();
	}, [walletAddress, isConnected, selectedChain.chainId]);

	// Get explorer URL based on current chain
	const getExplorerUrl = (txHash: string) => {
		switch (selectedChain.chainId) {
			case '0x1': return `https://etherscan.io/tx/${txHash}`;
			case '0x2105': return `https://basescan.org/tx/${txHash}`;
			case '0x89': return `https://polygonscan.com/tx/${txHash}`;
			case '0x38': return `https://bscscan.com/tx/${txHash}`;
			case '0xa': return `https://optimistic.etherscan.io/tx/${txHash}`;
			default: return `https://basescan.org/tx/${txHash}`;
		}
	};

	// Format transaction value
	const formatValue = (value: number | null | undefined, asset: string) => {
		if (value === null || value === undefined || isNaN(value)) return '0';
		if (value === 0) return '0';
		if (value < 0.000001) return value.toExponential(2);
		if (value < 0.01) return value.toFixed(6);
		if (value < 1) return value.toFixed(4);
		return value.toFixed(2);
	};

	// Get transaction type description
	const getTransactionType = (transfer: AlchemyAssetTransfer) => {
		if (transfer.category === 'external') {
			return transfer.from.toLowerCase() === walletAddress?.toLowerCase() ? 'Sent' : 'Received';
		}
		if (transfer.category === 'erc20') return 'Token Transfer';
		if (transfer.category === 'erc721') return 'NFT Transfer';
		if (transfer.category === 'erc1155') return 'NFT Transfer';
		return transfer.category.charAt(0).toUpperCase() + transfer.category.slice(1);
	};

	// Pagination logic
	const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const endIndex = startIndex + ITEMS_PER_PAGE;
	const currentTransactions = transactions.slice(startIndex, endIndex);

	// Reset to first page when transactions change
	useEffect(() => {
		setCurrentPage(1);
	}, [transactions]);

	return (
		<>
			{!isLoading ? (
				<div className="flex h-screen flex-col overflow-hidden">
					<TopBar />
					<div className="flex-1 flex flex-col p-3 pb-20 overflow-hidden">
						{error ? (
							<div className="text-center py-8">
								<p className="text-red-500 mb-4">Error: {error}</p>
								<Button 
									onClick={() => window.location.reload()} 
									variant="outline"
								>
									Retry
								</Button>
							</div>
						) : !walletAddress || !isConnected ? (
							<div className="text-center py-8">
								<p className="text-gray-500">Please connect your wallet to view transactions</p>
							</div>
						) : transactions.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-gray-500">No transactions found</p>
							</div>
						) : (
							<>
								<div className="flex-1 overflow-y-auto">
									<div className="space-y-3">
										{currentTransactions.map((transaction, index) => (
											<Card key={transaction.uniqueId || index} className="p-3">
												<div className="flex w-full justify-between items-start">
													<div className="flex-1 min-w-0 pr-2">
														<h3 className="text-sm font-semibold mb-1 break-all">
															{prettifyAddress(transaction.hash)}
														</h3>
														<div className="space-y-0.5">
															<p className="text-xs text-gray-600 break-words">
																{getTransactionType(transaction)} {transaction.asset}
															</p>
															<p className="text-xs text-gray-600 break-words">
																Amount: {formatValue(transaction.value, transaction.asset)} {transaction.asset}
															</p>
															<p className="text-xs text-gray-600 break-all">
																From: {prettifyAddress(transaction.from)}
															</p>
															<p className="text-xs text-gray-600 break-all">
																To: {prettifyAddress(transaction.to)}
															</p>
															{transaction.erc721TokenId && (
																<p className="text-xs text-gray-600 break-all">
																	Token ID: {transaction.erc721TokenId}
																</p>
															)}
														</div>
													</div>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => window.open(getExplorerUrl(transaction.hash), '_blank')}
														className="p-1 flex-shrink-0 h-6 w-6"
													>
														<ExternalLink className="h-3 w-3" />
													</Button>
												</div>
											</Card>
										))}
									</div>
								</div>
								
								{/* Pagination */}
								{totalPages > 1 && (
									<div className="flex items-center justify-between mt-4 pt-3 border-t">
										<div className="text-sm text-gray-600">
											Showing {startIndex + 1}-{Math.min(endIndex, transactions.length)} of {transactions.length}
										</div>
										<div className="flex items-center space-x-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
												disabled={currentPage === 1}
												className="h-8 w-8 p-0"
											>
												<ChevronLeft className="h-4 w-4" />
											</Button>
											<span className="text-sm font-medium px-2">
												{currentPage} of {totalPages}
											</span>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
												disabled={currentPage === totalPages}
												className="h-8 w-8 p-0"
											>
												<ChevronRight className="h-4 w-4" />
											</Button>
										</div>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			) : (
				<div className="flex h-screen flex-col overflow-hidden">
					<TopBar />
					<div className="flex-1 overflow-y-auto p-3">
						<div className="space-y-3">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					</div>
				</div>
			)}
		</>
	);
}
