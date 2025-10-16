import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/providers/theme';
import { useChain } from '@/providers/ChainProvider';
import { useLibBurner } from '@/providers/LibBurnerProvider';
import { useWalletConnect } from '@/providers/WalletConnectProvider';
import { setTestnetToggle, removeCustomChain } from '@/lib/storage';
import AddCustomChainModal from '@/components/AddCustomChainModal/AddCustomChainModal';
import { toast } from 'sonner';

function AppTheme() {
	const theme = useTheme();

	return (
		<div className="flex flex-col content-center gap-1 rounded-md">
			<div className="flex flex-row content-center items-baseline	 justify-between ">
				<h1>App Theme</h1>
				<Select
					onValueChange={event => {
						console.log(event);
						theme.setTheme(event as 'light' | 'dark' | 'system');
					}}
				>
					<SelectTrigger className="w-1/2" defaultValue={theme.theme}>
						<SelectValue placeholder="Theme" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="light">Light</SelectItem>
						<SelectItem value="dark">Dark</SelectItem>
						<SelectItem value="system">System</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

function AccountName() {
	const [accountName, setAccountName] = useState<string>('');

	return (
		<div className="flex flex-col content-center gap-1 rounded-md  py-3 ">
			<div className="flex flex-row content-center items-baseline	 justify-between ">
				<h1>Account Name</h1>
				<Input
					type="text"
					placeholder={localStorage.getItem('acc_name') || 'Account Name'}
					className="w-1/2"
					onChange={event => {
						console.log(event.target.value);
						if (event.target.value) {
							setAccountName(event.target.value);
						}
					}}
				/>
			</div>
			{accountName != '' && accountName.length > 3 ? (
				<Button
					className="mt-2 w-full"
					variant="secondary"
					onClick={() => {
						localStorage.setItem('acc_name', accountName);
						console.log(accountName);
					}}
				>
					Save
				</Button>
			) : (
				<> </>
			)}
		</div>
	);
}

function TestnetToggle() {
	const { isTestnetEnabled, setTestnetEnabled } = useChain();

	const handleToggle = (checked: boolean) => {
		setTestnetEnabled(checked);
		setTestnetToggle(checked);
		toast.success(`Testnet chains ${checked ? 'enabled' : 'disabled'}`);
	};

	return (
		<div className="flex flex-col content-center gap-1 rounded-md py-3">
			<div className="flex flex-row content-center items-baseline justify-between">
				<div>
					<h1>Testnet Chains</h1>
					<p className="text-sm text-muted-foreground">Show testnet chains in chain selector</p>
				</div>
				<Switch
					checked={isTestnetEnabled}
					onCheckedChange={handleToggle}
				/>
			</div>
		</div>
	);
}

function CustomChains() {
	const { availableChains, removeCustomChain: removeChain } = useChain();
	const customChains = availableChains.filter(chain => 
		!['0x1', '0x2105', '0x89', '0x38', '0xa', '0xaa36a7', '0x5', '0x14a33', '0x13881', '0x61', '0x1a4'].includes(chain.chainId)
	);

	const handleRemoveChain = (chainId: string) => {
		removeCustomChain(chainId); // Remove from storage
		removeChain(chainId); // Remove from context state
		toast.success('Custom chain removed');
	};

	return (
		<div className="flex flex-col content-center gap-1 rounded-md py-3">
			<div className="flex flex-row content-center items-baseline justify-between">
				<div>
					<h1>Custom Chains</h1>
					<p className="text-sm text-muted-foreground">Manage your custom blockchain networks</p>
				</div>
				<AddCustomChainModal>
					<Button variant="outline" size="sm">
						Add Chain
					</Button>
				</AddCustomChainModal>
			</div>
			
			{customChains.length > 0 ? (
				<div className="mt-4 space-y-2">
					{customChains.map((chain) => (
						<div key={chain.chainId} className="flex items-center justify-between p-3 border rounded-md">
							<div>
								<div className="font-medium">{chain.displayName}</div>
								<div className="text-sm text-muted-foreground">Chain ID: {chain.chainId}</div>
								{chain.isTestnet && (
									<span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
										Testnet
									</span>
								)}
							</div>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => handleRemoveChain(chain.chainId)}
							>
								Remove
							</Button>
						</div>
					))}
				</div>
			) : (
				<div className="mt-4 text-center text-muted-foreground">
					No custom chains added yet
				</div>
			)}
		</div>
	);
}

function LogoutSection() {
	const { isConnected, walletAddress, disconnect } = useLibBurner();
	const { disconnect: wcDisconnect } = useWalletConnect();

	const handleLogout = async () => {
		try {
			// Disconnect WalletConnect session(s) if any
			await wcDisconnect().catch(() => {});
		} catch {}

	try {
		// Disconnect LibBurner
		disconnect();
	} catch {}

	try {
		// Clear storage
		localStorage.clear();
		sessionStorage.clear();
	} catch {}

	try {
		// Clear Cache Storage
		if ('caches' in window) {
			const keys = await caches.keys();
			await Promise.all(keys.map(k => caches.delete(k)));
		}
	} catch {}

	try {
		// Unregister service workers
		if ('serviceWorker' in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(regs.map(r => r.unregister()));
		}
	} catch {}

	try {
		// Attempt to clear IndexedDB databases (best-effort)
		const anyIndexedDB: any = indexedDB as any;
		if (anyIndexedDB && typeof anyIndexedDB.databases === 'function') {
			const dbs = await anyIndexedDB.databases();
			await Promise.all(
				(dbs || []).map((db: any) => {
					if (!db || !db.name) return Promise.resolve();
					return new Promise<void>(resolve => {
						const req = indexedDB.deleteDatabase(db.name as string);
						req.onsuccess = req.onerror = req.onblocked = () => resolve();
					});
				})
			);
		}
	} catch {}

	toast.success('Logged out successfully');
	// Navigation will auto-redirect due to cleared storage in WalletLayout
	window.location.reload();

	};

	if (!isConnected || !walletAddress) {
		return null;
	}

	return (
		<div className="flex flex-col content-center gap-1 rounded-md py-3">
			<div className="flex flex-row content-center items-baseline justify-between">
				<div>
					<h1>Wallet</h1>
					<p className="text-sm text-muted-foreground">
						Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
					</p>
				</div>
				<Button
					variant="destructive"
					size="sm"
					onClick={handleLogout}
				>
					Logout
				</Button>
			</div>
		</div>
	);
}

export default function Settings() {
	return (
		<div className="flex h-screen flex-col">
			<div className="grid h-auto gap-6 p-4" onClick={() => {}}>
				<div className="grid h-auto gap-6 sm:grid-cols-1" onClick={() => {}}>
					<h1 className="text-2xl font-bold">Settings</h1>
					<Card>
						<CardContent>
							<LogoutSection />
							<AccountName />
							<AppTheme />
							<TestnetToggle />
							<CustomChains />
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
