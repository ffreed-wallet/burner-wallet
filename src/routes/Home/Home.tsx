import React, { useState, useEffect } from 'react';
import BalanceCard from '@/components/Cards/BalanceCard';
import CoinsCard from '@/components/Cards/CoinsCard';
import TopBar from '@/components/TopBar/TopBar';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useLibBurner } from '@/providers/LibBurnerProvider';
import { useChain } from '@/providers/ChainProvider';
import { getTokensForChain } from '@/lib/tokenLists';
import { getStoredTokens, saveToken } from '@/lib/storage';
import { getCoinGeckoIdByAddress, getTokenDetails } from '@/lib/coingecko';
import { RefreshCw } from 'lucide-react';
import { clearTokenCache } from '@/lib/tokenCache';

export default function Component() {
	const navigate = useNavigate();
	const { walletAddress: libBurnerAddress, isConnected, getZapperBalances, getGasTokenBalance, getTokenBalances, getTokenMetadata, getAlchemyTokenBalances, getAlchemyNativeBalance } = useLibBurner();
	const { selectedChain, getRpcUrl } = useChain();
	const [realBalances, setRealBalances] = useState<any>(null);
	const [loadingBalances, setLoadingBalances] = useState(false);
	const [customTokens, setCustomTokens] = useState<any[]>([]);
	const [tokenPrices, setTokenPrices] = useState<{ [key: string]: number }>({});
	const [tokenImages, setTokenImages] = useState<{ [key: string]: string }>({});
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Use LibBurner address if connected, otherwise fallback to localStorage or show connection prompt
	const getStoredWalletAddress = () => {
		return localStorage.getItem('libburner_address');
	};
	
	const displayWalletAddress = (isConnected && libBurnerAddress ? libBurnerAddress : getStoredWalletAddress()) as `0x${string}`;
	
	// Get the correct gas token symbol for the selected chain
	const getGasTokenSymbol = () => {
		return selectedChain.nativeToken?.symbol || 'ETH';
	};

	// Create balance object with real data only
	const getBalanceData = () => {
		if (realBalances && realBalances.gasToken !== undefined) {
			const gasTokenSymbol = getGasTokenSymbol();
			const balanceInEther = Number(realBalances.gasToken) / 1e18;
			
			return {
				contract_decimals: 18,
				contract_name: gasTokenSymbol,
				contract_ticker_symbol: gasTokenSymbol,
				contract_address: '0x0000000000000000000000000000000000000000',
				supports_erc: null,
				logo_url: '',
				block_height: 12345678,
				balance: realBalances.gasToken,
				quote_rate: 2000,
				quote: balanceInEther * 2000,
				pretty_quote: `$${(balanceInEther * 2000).toFixed(2)}`
			};
		}
		
		// Return null when no real data available
		return null;
	};

	const balanceData = getBalanceData();
	
	// Debug log to see what balance data is being used
	console.log('Balance data:', {
		isConnected,
		hasRealBalances: !!realBalances,
		gasTokenBalance: realBalances?.gasToken?.toString(),
		balanceData: balanceData?.balance?.toString(),
		loadingBalances,
		realBalancesGasToken: realBalances?.gasToken,
		realBalancesGasTokenType: typeof realBalances?.gasToken
	});

	// Format Alchemy tokens for display
	const formatAlchemyTokens = (tokens: any[]) => {
		return tokens.map(token => {
			const balanceInTokens = Number(token.balance) / Math.pow(10, token.decimals);
			const price = tokenPrices[token.contractAddress] || 0;
			const usdValue = balanceInTokens * price;
			
			return {
				contract_decimals: token.decimals,
				contract_name: token.name,
				contract_ticker_symbol: token.symbol,
				contract_address: token.contractAddress,
				logo_url: token.logo || tokenImages[token.contractAddress] || '',
				balance: Number(token.balance),
				quote_rate: price,
				quote: usdValue,
				pretty_quote: price > 0 ? `$${usdValue.toFixed(2)}` : `${balanceInTokens.toFixed(6)}`
			};
		});
	};

	// Force refresh function
	const handleForceRefresh = async () => {
		setIsRefreshing(true);
		clearTokenCache(); // Clear token cache to force fresh fetch
		
		// Reload balances
		await loadRealBalances();
		
		setIsRefreshing(false);
	};

	// Load real balances when connected or when using test address
	const loadRealBalances = async () => {
		if (isConnected && libBurnerAddress) {
			console.log('Loading real balances from Alchemy API...');
			setLoadingBalances(true);
			
			// Set a timeout to ensure loading never gets stuck
			const timeoutId = setTimeout(() => {
				console.log('Balance loading timeout - forcing loading to false');
				setLoadingBalances(false);
			}, 10000); // 10 second timeout
			
			try {
				// Get native token balance from Alchemy
				const gasTokenBalance = await getAlchemyNativeBalance();
				
				// Get all ERC-20 token balances from Alchemy
				const alchemyTokens = await getAlchemyTokenBalances();
				
				// Get other token balances from Zapper (as fallback)
				const zapperData = await getZapperBalances();
				
				console.log('Real balances loaded:', { gasTokenBalance, alchemyTokens, zapperData });
				
				setRealBalances({
					zapperData,
					gasToken: gasTokenBalance,
					alchemyTokens
				});
			} catch (err) {
				console.error('Failed to load real balances:', err);
				// Set empty balances on error to prevent skeleton
				setRealBalances({
					zapperData: null,
					gasToken: BigInt(0)
				});
			} finally {
				clearTimeout(timeoutId);
				setLoadingBalances(false);
			}
		} else if (!isConnected && displayWalletAddress !== '0x0000000000000000000000000000000000000000') {
			// Load balances for test address when not connected
			console.log('Loading test address balances from Alchemy API...');
			setLoadingBalances(true);
			
			// Set a timeout to ensure loading never gets stuck
			const timeoutId = setTimeout(() => {
				console.log('Test address balance loading timeout - forcing loading to false');
				setLoadingBalances(false);
			}, 10000); // 10 second timeout
			
			try {
				// Get native token balance from Alchemy for test address
				const gasTokenBalance = await getAlchemyNativeBalance(displayWalletAddress);
				
				// Get all ERC-20 token balances from Alchemy for test address
				const alchemyTokens = await getAlchemyTokenBalances(displayWalletAddress);
				
				// Get other token balances from Zapper
				const axios = (await import('axios')).default;
				const zapperResponse = await axios.get(
					"https://api.zapper.xyz/v2/balances/apps",
					{
						headers: {
							accept: "*/*",
							Authorization: "Basic MDZhMDYwYjctYWUxMi00N2U0LTkxZGItM2IzNTI2ODEzMTNjOg==",
						},
						params: {
							addresses: [displayWalletAddress],
						},
					}
				);
				
				console.log('Test address balances loaded:', { gasTokenBalance, alchemyTokens, zapperData: zapperResponse.data });
				
				setRealBalances({
					zapperData: zapperResponse.data,
					gasToken: gasTokenBalance,
					alchemyTokens
				});
			} catch (err) {
				console.error('Failed to load test address balances:', err);
				// Set empty balances on error to prevent skeleton
				setRealBalances({
					zapperData: null,
					gasToken: BigInt(0)
				});
			} finally {
				clearTimeout(timeoutId);
				setLoadingBalances(false);
			}
		}
	};

	// Load real balances when connected or when using test address
	useEffect(() => {
		loadRealBalances();
	}, [isConnected, libBurnerAddress, displayWalletAddress, selectedChain, getZapperBalances, getGasTokenBalance]);

	// Load stored tokens for current chain
	useEffect(() => {
		const loadStoredTokens = async () => {
			const storedTokens = getStoredTokens(selectedChain.chainId);
			if (storedTokens.length > 0) {
				// Convert stored tokens to the format expected by the component
				const formattedTokens = storedTokens.map(token => ({
					address: token.address,
					symbol: token.symbol,
					name: token.name,
					decimals: token.decimals,
					balance: BigInt(0), // Will be fetched separately
					coinGeckoId: token.coinGeckoId,
					logoUrl: token.logoUrl
				}));
				
				setCustomTokens(formattedTokens);
				
				// Fetch prices and images for stored tokens
				const pricePromises = formattedTokens.map(async (token) => {
					if (token.coinGeckoId) {
						try {
							const details = await getTokenDetails(token.coinGeckoId);
							return { 
								address: token.address, 
								price: details?.current_price || 0,
								image: details?.image || details?.small || details?.thumb || ''
							};
						} catch (error) {
							console.error(`Failed to fetch details for ${token.symbol}:`, error);
							return { address: token.address, price: 0, image: '' };
						}
					}
					return { address: token.address, price: 0, image: '' };
				});
				
				const results = await Promise.all(pricePromises);
				const priceMap = results.reduce((acc, { address, price }) => {
					acc[address] = price;
					return acc;
				}, {} as { [key: string]: number });
				
				const imageMap = results.reduce((acc, { address, image }) => {
					if (image) acc[address] = image;
					return acc;
				}, {} as { [key: string]: string });
				
				setTokenPrices(priceMap);
				setTokenImages(imageMap);
			}
		};
		
		loadStoredTokens();
	}, [selectedChain.chainId]);

	// Handle custom token addition
	const handleTokenAdded = (token: any) => {
		// Save token to browser storage
		saveToken({
			address: token.address,
			symbol: token.symbol,
			name: token.name,
			decimals: token.decimals,
			chainId: selectedChain.chainId,
			coinGeckoId: token.coinGeckoId,
			logoUrl: token.logoUrl
		});
		
		setCustomTokens(prev => [...prev, token]);
		
		// Fetch price and image for the new token
		if (token.coinGeckoId) {
			getTokenDetails(token.coinGeckoId).then(details => {
				if (details) {
					setTokenPrices(prev => ({
						...prev,
						[token.address]: details.current_price
					}));
					
					if (details.image || details.small || details.thumb) {
						setTokenImages(prev => ({
							...prev,
							[token.address]: details.image || details.small || details.thumb
						}));
					}
				}
			});
		}
	};

	// Create token balances from RPC data first, then Zapper as fallback, then custom tokens
	// Only show tokens for the currently selected chain
	const tokenBalances = realBalances && realBalances.tokenBalances ? 
		realBalances.tokenBalances.map((token: any) => {
			// Use RPC-fetched name and symbol as primary source
			const price = tokenPrices[token.address] || 0;
			const balanceInTokens = Number(token.balance) / Math.pow(10, token.decimals);
			const usdValue = balanceInTokens * price;
			
			return {
				contract_decimals: token.decimals,
				contract_name: token.name, // From RPC
				contract_ticker_symbol: token.symbol, // From RPC
				contract_address: token.address,
				logo_url: '',
				balance: Number(token.balance),
				quote_rate: price,
				quote: usdValue,
				pretty_quote: `$${usdValue.toFixed(2)}`
			};
		}) : 
		realBalances && realBalances.zapperData ? 
		realBalances.zapperData.balances?.[0]?.tokens?.map((token: any) => ({
			contract_decimals: token.decimals || 18,
			contract_name: token.name,
			contract_ticker_symbol: token.symbol,
			contract_address: token.address,
			logo_url: token.logoURI || '',
			balance: Number(token.balance),
			quote_rate: token.price || 1,
			quote: token.balanceUSD || 0,
			pretty_quote: `$${(token.balanceUSD || 0).toFixed(2)}`
		})) || [] : [];

	// Add custom tokens to the list with CoinGecko prices and images
	const allTokenBalances = [
		...tokenBalances, 
		...customTokens.map(token => {
			const price = tokenPrices[token.address] || 0;
			const image = tokenImages[token.address] || token.logoUrl || '';
			const balanceInTokens = Number(token.balance) / Math.pow(10, token.decimals);
			const usdValue = balanceInTokens * price;
			
			return {
				contract_decimals: token.decimals,
				contract_name: token.name,
				contract_ticker_symbol: token.symbol,
				contract_address: token.address,
				logo_url: image,
				balance: Number(token.balance),
				quote_rate: price,
				quote: usdValue,
				pretty_quote: `$${usdValue.toFixed(2)}`
			};
		}),
		// Add Alchemy tokens
		...(realBalances?.alchemyTokens ? formatAlchemyTokens(realBalances.alchemyTokens) : [])
	];

	return (
		<div className="flex h-screen flex-col overflow-hidden">
			<TopBar />
			<div className="grid h-auto gap-4 p-3 sm:gap-6 sm:p-5 md:p-10">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">Wallet</h1>
					<Button
						variant="outline"
						size="sm"
						onClick={handleForceRefresh}
						disabled={isRefreshing}
						className="h-8 px-3"
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				</div>
				
				<BalanceCard
					walletAddress={displayWalletAddress}
					totalBalance={balanceData}
					isLoading={loadingBalances}
				/>

				<CoinsCard 
					walletAddress={displayWalletAddress} 
					coinsList={allTokenBalances}
					onTokenAdded={handleTokenAdded}
				/>
			</div>
		</div>
	);
}
