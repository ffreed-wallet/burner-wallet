import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function GasTankCard({
	walletAddress,
	totalBalance,
	isLoading,
	...props
}: {
	walletAddress: `0x${string}`;
	totalBalance: {
		contract_decimals: number;
		contract_name: string;
		contract_ticker_symbol: string;
		contract_address: string;
		supports_erc: any;
		logo_url: string;
		block_height: number;
		balance: bigint;
		quote_rate: number;
		quote: number;
		pretty_quote: string;
	};
	isLoading: boolean;
}) {
	return (
		<Card className="basis-2 	" {...props}>
			<CardHeader className="pb-0">
				<CardTitle className="flex items-start">Gas Remaining</CardTitle>
			</CardHeader>

			<CardContent className="flex items-center pt-4 text-green-500	">
				{!isLoading && totalBalance != null ? (
					<>
						<h2 className="text-2xl font-bold">
							{totalBalance.contract_ticker_symbol}{' '}
							{`${parseFloat(
								(
									Number(totalBalance.balance.valueOf()) /
									10 ** totalBalance.contract_decimals
								).toString()
							).toPrecision(6)}`}
						</h2>
					</>
				) : (
					<>
						{' '}
						<Skeleton className="h-4 w-2/3" />
					</>
				)}
			</CardContent>
		</Card>
	);
}
