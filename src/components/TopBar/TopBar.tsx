import React from 'react';
import { ChainSelector } from '../ChainSelector/ChainSelector';
import QrScannerPopupV2 from '../QrScannerPopup/QrScannerPopupV2';
import WalletConnectModal from '../WalletConnectModal/WalletConnectModal';
import { QrCode, Wallet } from 'lucide-react';

export default function Component() {
	return (
		<nav className="flex flex-row px-3 pt-3 align-middle sm:px-5 sm:pt-5 md:px-10">
			<div className="flex-none align-middle">
				<ChainSelector />
			</div>
			<div className="grow" />
			<div className="flex-none align-middle flex gap-2">
				<QrScannerPopupV2 />
				<WalletConnectModal />
			</div>
		</nav>
	);
}
