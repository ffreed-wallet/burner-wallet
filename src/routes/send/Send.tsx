import React, { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar/TopBar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLibBurner } from '@/providers/LibBurnerProvider';
import { useChain } from '@/providers/ChainProvider';
import QrScannerPopupV2 from '@/components/QrScannerPopup/QrScannerPopupV2';
import PinInput from '@/components/PinInput/PinInput';
import { QrCode, RefreshCw } from 'lucide-react';
import { getCachedTokens, setCachedTokens, getCacheAge } from '@/lib/tokenCache';

function prettifyAddress(address) {
	return `${address.substring(0, 6)}...${address.substring(address.length - 4, address.length)}`;
}

function isValidETHAddress(str) {
	// Regex to check valid
	// BITCOIN Address
	let regex = new RegExp(/^(0x)?[0-9a-fA-F]{40}$/);

	// if str
	// is empty return false
	if (str == null) {
		return 'False';
	}

	// Return true if the str
	// matched the ReGex
	if (regex.test(str) == true) {
		return 'True';
	} else {
		return 'False';
	}
}

export default function Component() {
	const [isLoading, setIsLoading] = useState(true);
	const [tokens, setTokens] = useState<any[]>([]);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const [address, setAddress] = useState<string>('');
	const [resolvedAddress, setResolvedAddress] = useState<string>('');
	const [selectedToken, setSelectedToken] = useState<any>();
	const [amount, setAmount] = useState<string>('');
	const [gas, setGas] = useState<any>();
	const [tx, setTx] = useState<any>();
	const [isResolving, setIsResolving] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [sendError, setSendError] = useState<string | null>(null);
	const [txStatus, setTxStatus] = useState<'pending' | 'confirmed' | 'failed' | null>(null);
	const [txHash, setTxHash] = useState<string | null>(null);
	const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
	const [pendingTransaction, setPendingTransaction] = useState<any>(null);
	const [tokenBalance, setTokenBalance] = useState<string>('0');
	const [isLoadingBalance, setIsLoadingBalance] = useState(false);
	const [estimatedGasFee, setEstimatedGasFee] = useState<string>('0');

	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { getEnsAddress, sendUSD2, sendUSDC, sendGasToken, sendERC20Token, getZapperBalances, getAlchemyTokenBalances, walletAddress, getTokenBalances, getGasTokenBalance, getData } = useLibBurner();
	const { selectedChain } = useChain();

	// Simulate loading
	useEffect(() => {
		const timer = setTimeout(() => setIsLoading(false), 1000);
		return () => clearTimeout(timer);
	}, []);

	// Handle address parameter from QR scanner and token parameter from token click
	useEffect(() => {
		const addressParam = searchParams.get('address');
		const tokenParam = searchParams.get('token');
		
		if (addressParam) {
			setAddress(addressParam);
			handleAddressChange(addressParam);
		}
		
		if (tokenParam) {
			// Find and select the token by contract address
			const tokenToSelect = tokens.find(token => 
				token.contract_address.toLowerCase() === tokenParam.toLowerCase()
			);
			if (tokenToSelect) {
				setSelectedToken(tokenToSelect);
			}
		}
	}, [searchParams, tokens]);

	// Load user's tokens with caching
	const loadUserTokens = async (forceRefresh = false) => {
		if (!walletAddress) return;
		
		try {
			setIsRefreshing(true);
			
			// Check cache first (unless force refresh)
			if (!forceRefresh) {
				const cachedTokens = getCachedTokens(selectedChain.chainId, walletAddress);
				if (cachedTokens) {
					setTokens(cachedTokens);
					setIsRefreshing(false);
					return;
				}
			}
			
			// Get tokens from Alchemy API
			const alchemyTokens = await getAlchemyTokenBalances();
			const userTokens: any[] = [];
			
			if (alchemyTokens && alchemyTokens.length > 0) {
				// Filter tokens that have non-zero balance
				const tokensWithBalance = alchemyTokens.filter((token: any) => 
					token.balance && token.balance !== '0' && token.balance !== 0
				);
				
				const formattedTokens = tokensWithBalance.map((token: any) => ({
					id: token.contractAddress,
					contract_name: token.name,
					contract_display_name: token.symbol,
					contract_address: token.contractAddress,
					contract_decimals: token.decimals || 18,
					supports_erc: ['erc20'],
					balance: token.balance.toString(),
					logo_url: token.logo
				}));
				
				userTokens.push(...formattedTokens);
			}

			// Also get tokens from Zapper as fallback
			const zapperData = await getZapperBalances();
			if (zapperData?.balances?.[0]?.tokens) {
				// Filter tokens that have non-zero balance
				const tokensWithBalance = zapperData.balances[0].tokens.filter((token: any) => 
					token.balance && token.balance !== '0' && token.balance !== 0
				);
				
				const zapperTokens = tokensWithBalance.map((token: any) => ({
					id: token.address,
					contract_name: token.name,
					contract_display_name: token.symbol,
					contract_address: token.address,
					contract_decimals: token.decimals || 18,
					supports_erc: ['erc20'],
					balance: token.balance,
					logo_url: token.logoURI
				}));
				
				userTokens.push(...zapperTokens);
			}
			
			// Add native gas token
			const gasTokenSymbol = getGasTokenSymbol();
			userTokens.unshift({
				id: 'native',
				contract_name: gasTokenSymbol,
				contract_display_name: gasTokenSymbol,
				contract_address: '0x0000000000000000000000000000000000000000',
				contract_decimals: 18,
				supports_erc: ['native'],
				balance: '0', // Will be updated with actual balance
				logo_url: ''
			});
			
			setTokens(userTokens);
			
			// Cache the tokens
			setCachedTokens(userTokens, selectedChain.chainId, walletAddress);
		} catch (err) {
			console.error('Failed to load user tokens:', err);
		} finally {
			setIsRefreshing(false);
		}
	};

	// Helper function to get gas token symbol
	const getGasTokenSymbol = () => {
		switch (selectedChain.chainId) {
			case '0x1': return 'ETH';
			case '0x2105': return 'ETH';
			case '0x89': return 'MATIC';
			case '0x38': return 'BNB';
			case '0xa': return 'ETH';
			default: return 'ETH';
		}
	};

	// Load tokens on mount and when wallet/chain changes
	useEffect(() => {
		if (walletAddress) {
			loadUserTokens();
		}
	}, [walletAddress, selectedChain.chainId]);

	// Load token balance when token is selected
	const loadTokenBalance = async (token: any) => {
		if (!walletAddress || !token) return;
		
		setIsLoadingBalance(true);
		try {
			if (token.contract_address === '0x0000000000000000000000000000000000000000') {
				// For native gas token, get balance from LibBurner
				const balance = await getGasTokenBalance();
				const balanceInTokens = Number(balance) / Math.pow(10, token.contract_decimals);
				setTokenBalance(balanceInTokens.toString());
			} else {
				// For ERC-20 tokens, get balance from token list or API
				const tokenWithBalance = tokens.find(t => t.contract_address === token.contract_address);
				if (tokenWithBalance && tokenWithBalance.balance) {
					const balanceInTokens = Number(tokenWithBalance.balance) / Math.pow(10, token.contract_decimals);
					setTokenBalance(balanceInTokens.toString());
				} else {
					setTokenBalance('0');
				}
			}
		} catch (error) {
			console.error('Failed to load token balance:', error);
			setTokenBalance('0');
		} finally {
			setIsLoadingBalance(false);
		}
	};

	// Load balance when token is selected
	useEffect(() => {
		if (selectedToken) {
			loadTokenBalance(selectedToken);
		}
	}, [selectedToken, tokens]);

	// Estimate gas fee for native token transactions
	const estimateGasFee = async () => {
		if (!selectedToken || !resolvedAddress || selectedToken.contract_address !== '0x0000000000000000000000000000000000000000') {
			return;
		}

		try {
			// Use a conservative gas estimate for simple ETH transfers
			// Standard ETH transfer uses ~21,000 gas units
			const gasLimit = 21000n;
			
			// Get current gas price (using a reasonable estimate)
			let gasPrice: bigint;
			switch (selectedChain.chainId) {
				case '0x1': // Ethereum mainnet
					gasPrice = 20000000000n; // 20 Gwei
					break;
				case '0x2105': // Base
					gasPrice = 1000000000n; // 1 Gwei
					break;
				case '0x89': // Polygon
					gasPrice = 30000000000n; // 30 Gwei
					break;
				case '0x38': // BSC
					gasPrice = 5000000000n; // 5 Gwei
					break;
				case '0xa': // Optimism
					gasPrice = 1000000n; // 0.001 Gwei
					break;
				default:
					gasPrice = 1000000000n; // 1 Gwei default
			}

			const totalGasFee = gasLimit * gasPrice;
			const gasFeeInEth = Number(totalGasFee) / 1e18;
			
			// Add 10% buffer for safety
			const gasFeeWithBuffer = gasFeeInEth * 1.1;
			
			setEstimatedGasFee(gasFeeWithBuffer.toFixed(6));
		} catch (error) {
			console.error('Failed to estimate gas fee:', error);
			// Fallback to a conservative estimate
			setEstimatedGasFee('0.001');
		}
	};

	// Estimate gas when address and token are ready
	useEffect(() => {
		if (resolvedAddress && selectedToken) {
			estimateGasFee();
		}
	}, [resolvedAddress, selectedToken, selectedChain.chainId]);

	// Handle Max button click
	const handleMaxClick = () => {
		if (!selectedToken || !tokenBalance) return;
		
		const balance = parseFloat(tokenBalance);
		if (balance <= 0) return;
		
		if (selectedToken.contract_address === '0x0000000000000000000000000000000000000000') {
			// For gas token, subtract estimated gas fee
			const gasFee = parseFloat(estimatedGasFee);
			const maxAmount = Math.max(0, balance - gasFee);
			setAmount(maxAmount.toFixed(6));
		} else {
			// For ERC-20 tokens, use full balance
			setAmount(balance.toFixed(6));
		}
	};

	// Handle ENS resolution
	const handleAddressChange = async (value: string) => {
		setAddress(value);
		
		// Convert to lowercase for ENS resolution
		const lowerValue = value.toLowerCase();
		
		// Check if it's an ENS name (ends with .eth)
		if (lowerValue.endsWith('.eth')) {
			setIsResolving(true);
			try {
				console.log('Resolving ENS name:', lowerValue);
				const resolvedAddr = await getEnsAddress(lowerValue);
				console.log('ENS resolution result:', resolvedAddr);
				if (resolvedAddr) {
					setResolvedAddress(resolvedAddr);
				} else {
					setResolvedAddress('');
				}
			} catch (err) {
				console.error('Failed to resolve ENS name:', err);
				setResolvedAddress('');
			} finally {
				setIsResolving(false);
			}
		} else if (isValidETHAddress(value) === 'True') {
			setResolvedAddress(value);
		} else {
			setResolvedAddress('');
		}
	};

	// Execute the actual transaction
	const executeTransaction = async (txData: any, pin?: string) => {
		setIsSending(true);
		setSendError(null);
		setTxStatus('pending');
		setTxHash(null);

		try {
			const amountBigInt = BigInt(Math.floor(parseFloat(txData.amount) * Math.pow(10, txData.selectedToken.contract_decimals)));
			let hash: string;

			if (txData.selectedToken.contract_address === '0x0000000000000000000000000000000000000000') {
				// Gas token (ETH/MATIC/BNB)
				hash = await sendGasToken(txData.resolvedAddress, amountBigInt, pin);
			} else if (txData.selectedToken.contract_display_name === 'USD2') {
				// USD2 token (LibBurner specific)
				hash = await sendUSD2(txData.resolvedAddress, amountBigInt, pin);
			} else if (txData.selectedToken.contract_display_name === 'USDC') {
				// USDC token (LibBurner specific)
				hash = await sendUSDC(txData.resolvedAddress, amountBigInt, pin);
			} else if (txData.selectedToken.supports_erc?.includes('erc20')) {
				// Generic ERC-20 token
				hash = await sendERC20Token(txData.selectedToken.contract_address, txData.resolvedAddress, amountBigInt, pin);
			} else {
				throw new Error('Unsupported token type');
			}

			setTxHash(hash);
			setTxStatus('confirmed');
			
			// Wait a moment to show the transaction hash before showing success screen
			setTimeout(() => {
				setTx({
					receipt: {
						transactionHash: hash
					}
				});
			}, 2000);
		} catch (err) {
			console.error('Send transaction failed:', err);
			const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
			
			// Check for Missing burner data error and call LibBurner
			if (errorMessage.includes('Missing burner data')) {
				setSendError('Missing burner data. Please tap your burner card...');
				
				// Call LibBurner to get data from the card
				try {
					console.log('Calling LibBurner getData to retrieve missing burner data...');
					await getData();
					setSendError('Burner data retrieved. Continuing transaction...');
					
					// Continue with the transaction after getting burner data
					setTimeout(async () => {
						try {
							const amountBigInt = BigInt(Math.floor(parseFloat(txData.amount) * Math.pow(10, txData.selectedToken.contract_decimals)));
							let hash: string;

							if (txData.selectedToken.contract_address === '0x0000000000000000000000000000000000000000') {
								hash = await sendGasToken(txData.resolvedAddress, amountBigInt, txData.pin);
							} else if (txData.selectedToken.contract_display_name === 'USD2') {
								hash = await sendUSD2(txData.resolvedAddress, amountBigInt, txData.pin);
							} else if (txData.selectedToken.contract_display_name === 'USDC') {
								hash = await sendUSDC(txData.resolvedAddress, amountBigInt, txData.pin);
							} else if (txData.selectedToken.supports_erc?.includes('erc20')) {
								hash = await sendERC20Token(txData.selectedToken.contract_address, txData.resolvedAddress, amountBigInt, txData.pin);
							} else {
								throw new Error('Unsupported token type');
							}

							setTxHash(hash);
							setTxStatus('confirmed');
							setSendError(null);
							
							setTimeout(() => {
								setTx({
									receipt: {
										transactionHash: hash
									}
								});
							}, 2000);
						} catch (retryErr) {
							console.error('Retry transaction failed:', retryErr);
							setSendError(retryErr instanceof Error ? retryErr.message : 'Transaction failed');
							setTxStatus('failed');
						} finally {
							setIsSending(false);
						}
					}, 1000); // Wait 1 second before retrying
				} catch (burnerErr) {
					console.error('Failed to get burner data:', burnerErr);
					setSendError('Failed to retrieve burner data. Please tap your burner card and try again.');
					setTxStatus('failed');
					setIsSending(false);
				}
			} else {
				setSendError(errorMessage);
				setTxStatus('failed');
				setIsSending(false);
			}
		}
	};

	// Handle sending transaction - prompt for password first
	const handleSend = async () => {
		if (!resolvedAddress || !selectedToken || !amount) {
			setSendError('Please fill in all fields');
			return;
		}

		// Store transaction data and show password prompt
		setPendingTransaction({
			resolvedAddress,
			selectedToken,
			amount
		});
		setShowPasswordPrompt(true);
	};

	// Handle password entered
	const handlePasswordEntered = async (pin: string) => {
		setShowPasswordPrompt(false);
		
		if (pendingTransaction) {
			// Add PIN to transaction data
			const txDataWithPin = {
				...pendingTransaction,
				pin: pin
			};
			await executeTransaction(txDataWithPin, pin);
			setPendingTransaction(null);
		}
	};

	if (!tx)
		return (
			<>
				{isLoading ? (
					<div className="flex h-screen flex-col">
						<TopBar />
						<div className="grid h-auto gap-6 p-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					</div>
				) : (
					<div className="flex h-screen flex-col">
						<TopBar />
						<div className="flex h-full flex-col justify-center p-4 pb-[100px]">
							<div className="grid h-auto w-full gap-6">
								<div className="flex flex-col gap-2">
									<h3>To : </h3>
									<div className="flex gap-2">
										<Input
											placeholder="Enter Address or ENS name (e.g., vitalik.eth)"
											value={address}
											onChange={e => {
												handleAddressChange(e.target.value);
											}}
											className="flex-1 lowercase"
											style={{ textTransform: 'lowercase' }}
										/>
										<QrScannerPopupV2 />
									</div>
									{isResolving && (
										<div className="text-sm text-gray-500">Resolving ENS name...</div>
									)}
									{resolvedAddress && (
										<div className="text-sm text-green-600 space-y-1">
											{address.endsWith('.eth') ? (
												<>
													<div>Resolved to:</div>
													<div className="font-mono text-xs break-all bg-green-50 p-2 rounded border">
														{resolvedAddress}
													</div>
												</>
											) : (
												<div>Valid address: {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}</div>
											)}
										</div>
									)}
								</div>

								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between">
										<h3>Token : </h3>
										<Button
											variant="outline"
											size="sm"
											onClick={() => loadUserTokens(true)}
											disabled={isRefreshing}
											className="h-8 px-2"
										>
											<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
										</Button>
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											{selectedToken ? (
												<div className="w-full rounded border p-2 text-start flex items-center gap-2">
													{selectedToken.logo_url && (
														<img 
															src={selectedToken.logo_url} 
															alt={selectedToken.contract_display_name}
															className="w-6 h-6 rounded-full"
															onError={(e) => {
																e.currentTarget.style.display = 'none';
															}}
														/>
													)}
													<span>{selectedToken.contract_display_name}</span>
												</div>
											) : (
												<div className="text-muted-foreground w-full rounded border p-2 text-start ">
													Select Token
												</div>
											)}
										</DropdownMenuTrigger>
										<DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
											{tokens.length === 0 ? (
												<DropdownMenuItem disabled>
													No tokens found in wallet
												</DropdownMenuItem>
											) : (
												tokens.map(token => {
													return (
														<DropdownMenuItem
															key={token.id}
															className="flex items-center gap-2"
															onClick={() => {
																setSelectedToken(token);
															}}
														>
															{token.logo_url && (
																<img 
																	src={token.logo_url} 
																	alt={token.contract_display_name}
																	className="w-6 h-6 rounded-full"
																	onError={(e) => {
																		e.currentTarget.style.display = 'none';
																	}}
																/>
															)}
															<div className="flex flex-col">
																<span className="font-medium">{token.contract_display_name}</span>
																<span className="text-sm text-gray-500">{token.contract_name}</span>
															</div>
														</DropdownMenuItem>
													);
												})
											)}
										</DropdownMenuContent>
									</DropdownMenu>
									
									{/* Token Address and Balance Display */}
									{selectedToken && (
										<div className="space-y-2 text-sm">
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Address:</span>
												<span className="font-mono text-xs break-all">
													{selectedToken.contract_address === '0x0000000000000000000000000000000000000000' 
														? 'Native Token' 
														: `${selectedToken.contract_address.slice(0, 6)}...${selectedToken.contract_address.slice(-4)}`
													}
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Balance:</span>
												<span className="font-medium">
													{isLoadingBalance ? (
														<span className="text-xs text-muted-foreground">Loading...</span>
													) : (
														`${parseFloat(tokenBalance).toFixed(6)} ${selectedToken.contract_display_name}`
													)}
												</span>
											</div>
										</div>
									)}
								</div>

								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between">
										<h3 className="pb-0">Amount : </h3>
										{selectedToken && parseFloat(tokenBalance) > 0 && (
											<Button
												variant="outline"
												size="sm"
												onClick={handleMaxClick}
												className="h-8 px-3 text-xs"
											>
												MAX
											</Button>
										)}
									</div>
									<Input
										placeholder="Amount"
										value={amount}
										onChange={e => {
											setAmount(e.target.value);
										}}
									/>
									{selectedToken && parseFloat(tokenBalance) > 0 && (
										<div className="text-xs text-muted-foreground space-y-1">
											<div>Available: {parseFloat(tokenBalance).toFixed(6)} {selectedToken.contract_display_name}</div>
											{selectedToken.contract_address === '0x0000000000000000000000000000000000000000' && parseFloat(estimatedGasFee) > 0 && (
												<div>Gas fee: ~{estimatedGasFee} {selectedToken.contract_display_name}</div>
											)}
										</div>
									)}
								</div>
							</div>
							
							<Button
								className="w-full mt-6"
								onClick={handleSend}
								disabled={isSending || !resolvedAddress || !selectedToken || !amount}
							>
								{isSending ? 'Sending...' : 'Send'}
							</Button>
							
							{/* Transaction Status */}
							{txStatus === 'pending' && (
								<div className="text-sm text-blue-600 mt-2 text-center">
									<div className="flex items-center justify-center gap-2">
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
										Processing transaction...
									</div>
								</div>
							)}
							
							{txStatus === 'confirmed' && txHash && (
								<div className="text-sm text-green-600 mt-2 text-center">
									<div className="space-y-1">
										<div>✅ Transaction confirmed!</div>
										<div className="font-mono text-xs break-all bg-green-50 p-2 rounded border">
											{txHash}
										</div>
									</div>
								</div>
							)}
							
							{txStatus === 'failed' && (
								<div className="text-sm text-red-600 mt-2 text-center">
									❌ Transaction failed
								</div>
							)}
							
							{sendError && (
								<div className="text-sm text-red-600 mt-2">
									{sendError}
								</div>
							)}
							<h5>{gas ? gas : <></>}</h5>
						</div>
					</div>
				)}
				
				{/* Password Prompt */}
				<PinInput
					isOpen={showPasswordPrompt}
					onClose={() => {
						setShowPasswordPrompt(false);
						setPendingTransaction(null);
					}}
					onPinEntered={handlePasswordEntered}
					title="Enter PIN"
					description="Please enter your PIN to authorize this transaction"
				/>
			</>
		);
	return (
		<div className="flex h-screen flex-col">
			<TopBar />
			<div className="flex h-full flex-col justify-center gap-6 p-4 pb-20">
				<h1 className="text-2xl font-bold">Transaction Sent!</h1>
				<div className="text-center">
					<p className="text-lg">Transaction Hash:</p>
					<p className="font-mono text-sm break-all">{tx.receipt?.transactionHash}</p>
				</div>
				<Button className="w-full" variant="secondary" onClick={() => navigate('/home')}>
					Back to Home
				</Button>
				<Button
					className="w-full"
					variant="secondary"
					onClick={() => {
						// Get the appropriate explorer URL based on the chain
						const getExplorerUrl = () => {
							switch (selectedChain.chainId) {
								case '0x1': return 'https://etherscan.io';
								case '0x2105': return 'https://basescan.org';
								case '0x89': return 'https://polygonscan.com';
								case '0x38': return 'https://bscscan.com';
								case '0xa': return 'https://optimistic.etherscan.io';
								default: return selectedChain.blockExplorerUrl || 'https://etherscan.io';
							}
						};
						const url = `${getExplorerUrl()}/tx/${tx.receipt?.transactionHash}`;
						window.open(url, '_blank');
					}}
				>
					View on Explorer
				</Button>
			</div>
		</div>
	);
}
