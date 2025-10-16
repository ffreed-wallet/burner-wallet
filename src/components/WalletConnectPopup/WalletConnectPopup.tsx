import React, { useState } from 'react';
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from '@/components/ui/drawer';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

// interface ModalState {
// 	open: boolean
// 	view?:
// 	| 'SessionProposalModal'
// 	| 'SessionSignModal'
// 	| 'SessionSignTypedDataModal'
// 	| 'SessionSendTransactionModal'
// 	| 'SessionUnsuportedMethodModal'
// 	| 'AuthRequestModal'
// 	| 'LoadingModal'
// 	data?: ModalData
// }

export default function WalletConnectPopup() {
	const [wcLink, setWcLink] = useState<string>('');
	const [wcModalData, setWcModalData] = useState<any>({
		open: false,
		view: undefined,
		data: undefined
	});

	const [loading, setLoading] = useState<boolean>(false);

	const pairWallet = async () => {
		try {
			console.log('Mock WalletConnect pairing with:', wcLink);
		} catch (e) {
			console.log('Error:', e);
		}
	};

	const approve = async () => {
		console.log('Mock approve request');
	};

	return (
		<Drawer open={wcModalData.open}>
			<DrawerContent className="justify align-middle">
				<DrawerHeader>
					<DrawerTitle>Wallet Connect</DrawerTitle>
					<DrawerDescription>Wallet Connect request</DrawerDescription>
				</DrawerHeader>

				<div className="flex w-full flex-col gap-5 p-5">
					<div className="text-center">
						<p className="text-muted-foreground">WalletConnect Placeholder</p>
						<p className="text-sm text-muted-foreground">Connect to dApps and wallets</p>
					</div>
					<Input
						onChange={e => {
							console.log(e.target.value);
							setWcLink(e.target.value);
						}}
						placeholder="Enter URI"
					/>

					<Button
						onClick={() => {
							try {
								pairWallet();
							} catch (e) {
								console.log('Error:', e);
							}
						}}
					>
						Connect
					</Button>
				</div>

				<DrawerFooter className="flex w-full flex-row justify-center align-middle">
					<Button
						className="mr-10"
						onClick={() => {
							approve();
						}}
					>
						Accept
					</Button>
					<DrawerClose>
						<Button
							variant="outline"
							onClick={() => {
								setWcModalData({ open: false });
							}}
						>
							Cancel
						</Button>
					</DrawerClose>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
