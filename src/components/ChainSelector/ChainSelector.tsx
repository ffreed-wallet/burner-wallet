'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useChain } from '@/providers/ChainProvider';

export function ChainSelector() {
	const { selectedChain, setSelectedChain, availableChains } = useChain();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">{selectedChain.displayName}</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-48 ml-3">
				{availableChains.map(chain => {
					const selected = chain.chainId === selectedChain.chainId;
					let imageClass = 'aspect-square ';
					if (!selected) imageClass += 'grayscale	';

					const textClass = selected ? 'flex-auto text-green-500 dark:text-green-400' : 'flex-auto text-muted-foreground';
					return (
						<DropdownMenuItem
							key={chain.chainId}
							onSelect={() => {
								setSelectedChain(chain);
							}}
						>
							<div className="flex flex-auto text-right">
								<div>
									<img alt="Logo" className={imageClass} height="20" src={chain.logo} width="20" />
								</div>
								<div className={textClass}>{chain.displayName}</div>
							</div>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
