import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AddTokenModal from '@/components/AddTokenModal/AddTokenModal';
import { useNavigate } from 'react-router-dom';

// Helper function to format token balances with appropriate decimal places
const formatTokenBalance = (balance: number, decimals: number): string => {
	const balanceInTokens = balance / Math.pow(10, decimals);
	
	// For very small amounts, show more decimal places
	if (balanceInTokens < 0.01) {
		return balanceInTokens.toFixed(6);
	}
	// For small amounts, show 4 decimal places
	else if (balanceInTokens < 1) {
		return balanceInTokens.toFixed(4);
	}
	// For larger amounts, show 2 decimal places
	else {
		return balanceInTokens.toFixed(2);
	}
};

export function TableDemo({ coinsList }: { coinsList: any[] }) {
	const [loading, setLoading] = useState(true);
	const navigate = useNavigate();
	
	useEffect(() => {
		if (coinsList != null) {
			setLoading(false);
		} else {
			setLoading(true);
		}
	}, [coinsList]);

	const handleTokenClick = (coin: any) => {
		// Navigate to send tab with token pre-selected
		navigate(`/send?token=${encodeURIComponent(coin.contract_address)}`);
	};
	return (
		<div className="flex w-full flex-col gap-1">
			{!loading ? (
				<>
					{' '}
					{coinsList?.map(coin => (
						<div key={coin.contract_address}>
							<div 
								className="flex w-auto rounded-md p-1 cursor-pointer hover:bg-gray-50 transition-colors"
								onClick={() => handleTokenClick(coin)}
							>
								<div className="mr-2 h-8 w-8 self-center rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
									{coin.logo_url ? (
										<img
											src={coin.logo_url}
											alt={coin.contract_ticker_symbol}
											className="h-full w-full object-cover"
											onError={e => {
												e.currentTarget.style.display = 'none';
												(e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
											}}
										/>
									) : null}
									<div 
										className="h-full w-full flex items-center justify-center text-xs font-bold text-gray-600"
										style={{ display: coin.logo_url ? 'none' : 'flex' }}
									>
										{coin.contract_ticker_symbol?.slice(0, 2).toUpperCase() || '?'}
									</div>
								</div>
								<div className="grow self-center">
									<div className="font-medium">{coin.contract_ticker_symbol}</div>
									<div className="text-xs text-muted-foreground">{coin.contract_name}</div>
								</div>
								<div className="flex flex-col self-center text-right">
									<div className={coin.balance === 0 ? 'text-muted-foreground' : ''}>{coin.pretty_quote}</div>
									<div className="text-muted-foreground text-xs">
										{formatTokenBalance(coin.balance, coin.contract_decimals)}
										{coin.balance === 0 && <span className="text-muted-foreground ml-1">(0)</span>}
									</div>
								</div>
							</div>
						</div>
					))}
				</>
			) : (
				<>
					<div key={'t'}>
						<Skeleton className="my-5 h-5 w-1/2" />
						<Skeleton className="my-5 h-5 w-1/4" />
					</div>{' '}
				</>
			)}
		</div>
	);
}


export default function CoinsCard({
	walletAddress,
	coinsList,
	onTokenAdded,
	...props
}: {
	walletAddress: `0x${string}`;
	coinsList: any[];
	onTokenAdded?: (token: any) => void;
}) {
	return (
		<Card className="basis-3" {...props}>
			<CardHeader className="pb-0">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-start">Token Balances</CardTitle>
					<AddTokenModal onTokenAdded={onTokenAdded} />
				</div>
			</CardHeader>

			<CardContent className="mt-2 flex items-center rounded-md pt-4">
				<TableDemo coinsList={coinsList} />
			</CardContent>
		</Card>
	);
}
