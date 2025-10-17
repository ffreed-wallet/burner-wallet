import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import AddFundsButton from '@/components/AddFundsButton/AddFundsButton';
import { Skeleton } from '@/components/ui/skeleton';
import QRCodeGenerator from '@/components/QRCodeGenerator/QRCodeGenerator';
import { useLibBurner } from '@/providers/LibBurnerProvider';
import { useChain } from '@/providers/ChainProvider';

function ImageComponent({ walletAddress }: { walletAddress: `0x${string}` }) {
	return (
		<div className="rounded p-5">
			<QRCodeGenerator
				data={walletAddress}
				className="mb-4"
			/>
		</div>
	);
}

export default function BalanceCard({
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
	const [copiedAddress, setCopiedAddress] = useState(false);
	const [ensName, setEnsName] = useState<string | null>(null);
	const { walletAddress: libBurnerAddress, isConnected, getEnsName } = useLibBurner();
	const { selectedChain } = useChain();

	useEffect(() => {
		if (copiedAddress) {
			setTimeout(() => {
				setCopiedAddress(false);
			}, 2000);
		}
	}, [copiedAddress]);

	// Fetch ENS name when wallet address changes
	useEffect(() => {
		const fetchEnsName = async () => {
			if (libBurnerAddress && isConnected) {
				try {
					const name = await getEnsName(libBurnerAddress);
					setEnsName(name);
				} catch (err) {
					console.error('Failed to fetch ENS name:', err);
					setEnsName(null);
				}
			} else {
				setEnsName(null);
			}
		};

		fetchEnsName();
	}, [libBurnerAddress, isConnected, getEnsName]);

	return (
		<Dialog>

			<DialogTrigger asChild>
				<Card className="basis-2" {...props}>

					<CardHeader
						className="cursor-pointer pb-0"
					>
						<CardTitle className="flex items-start">
							{isConnected && libBurnerAddress ? (
								<div className="flex flex-col">
									<span className="text-sm text-muted-foreground">
										{ensName ? ensName : 'LibBurner Wallet'} ({selectedChain.displayName})
									</span>
									<span className="font-mono text-xs break-all">
										{libBurnerAddress.slice(0, 6)}...{libBurnerAddress.slice(-4)}
									</span>
								</div>
							) : (
								'Connect LibBurner'
							)}
						</CardTitle>
					</CardHeader>

					<CardContent className="flex cursor-alias items-center pt-4	">
						{!isLoading && totalBalance != null ? (
							<>
								<h2 className="text-md font-bold">
									{totalBalance.contract_ticker_symbol}{' '}
									{`${parseFloat(
										(
											Number(totalBalance.balance.valueOf()) /
											10 ** totalBalance.contract_decimals
										).toString()
									).toPrecision(6)}`}{' '}
								</h2>
							</>
						) : (
							<div className="h-4 w-full">
								{' '}
								<Skeleton className="h-4 w-2/3" />
							</div>
						)}
					</CardContent>
				</Card>
			</DialogTrigger>

			<DialogContent className="max-w-[90vw] w-[90vw]">
				<ImageComponent walletAddress={isConnected && libBurnerAddress ? libBurnerAddress as `0x${string}` : walletAddress} />
			</DialogContent>
		</Dialog>
	);
}
