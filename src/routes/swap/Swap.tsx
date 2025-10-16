import React, { useState } from 'react';
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
	const [tokens, setTokens] = useState([
		{
			id: '1',
			contract_name: 'Ethereum',
			contract_display_name: 'ETH',
			contract_address: '0x0000000000000000000000000000000000000000',
			contract_decimals: 18,
			supports_erc: ['native']
		},
		{
			id: '2',
			contract_name: 'USD Coin',
			contract_display_name: 'USDC',
			contract_address: '0xA0b86a33E6441b8C4C8C0C4C0C4C0C4C0C4C0C4C',
			contract_decimals: 6,
			supports_erc: ['erc20']
		}
	]);

	const [address, setAddress] = useState<string>('');
	const [selectedToken, setSelectedToken] = useState<any>();
	const [fromToken, setFromToken] = useState<any>();
	const [amount, setAmount] = useState<string>('');
	const [gas, setGas] = useState<any>();

	// Simulate loading
	setTimeout(() => setIsLoading(false), 1000);

	return (
		<>
			{isLoading ? (
				<div className="flex h-screen flex-col">
					<TopBar />
					<div className="flex h-full flex-col justify-center p-10 pb-20">
						<div className="grid h-auto w-full gap-6">
							<div className="flex flex-col gap-2">
								<h3>From : </h3>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										{fromToken ? (
											<div className="w-full rounded border p-2 text-start ">
												{fromToken.contract_display_name}
											</div>
										) : (
											<div className="text-muted-foreground w-full rounded border p-2 text-start ">
												Select Source Token
											</div>
										)}
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-full">
										{tokens.map(token => {
											return (
												<DropdownMenuItem
													key={token.id}
													className=""
													onClick={() => {
														setFromToken(token);
													}}
												>
													{token.contract_name}
												</DropdownMenuItem>
											);
										})}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							<div className="flex flex-col gap-2">
								<h3>Token : </h3>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										{selectedToken ? (
											<div className="w-full rounded border p-2 text-start ">
												{selectedToken.contract_display_name}
											</div>
										) : (
											<div className="text-muted-foreground w-full rounded border p-2 text-start ">
												Select Token
											</div>
										)}
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-full">
										{tokens.map(token => {
											return (
												<DropdownMenuItem
													key={token.id}
													className=""
													onClick={() => {
														setSelectedToken(token);
													}}
												>
													{token.contract_name}
												</DropdownMenuItem>
											);
										})}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							<div className="flex flex-col gap-2">
								<h3 className="pb-0">Amount : </h3>
								<Input
									placeholder="Amount"
									onChange={e => {
										setAmount(e.target.value);
									}}
								/>
							</div>
						</div>
						<div className="grow" />
						<Button
							className="w-full"
							variant="secondary"
							onClick={() => {
								// Mock swap action
								console.log('Mock swap action');
							}}
						>
							Swap
						</Button>
						<h5>{gas ? gas : <></>}</h5>
					</div>
				</div>
			) : (
				<div className="flex h-screen flex-col">
					<TopBar />
					<div className="grid h-auto gap-6 p-10">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				</div>
			)}
		</>
	);
}
