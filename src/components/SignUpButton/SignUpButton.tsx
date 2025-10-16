import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useLibBurner } from '@/providers/LibBurnerProvider';

export default function LibBurnerConnectButton() {
	const navigate = useNavigate();
	const { connect, isConnecting, isConnected, error } = useLibBurner();

	const handleConnect = async () => {
		try {
			await connect();
			// Navigate immediately after successful connection
			navigate('/home');
		} catch (err) {
			console.error('Failed to connect LibBurner:', err);
		}
	};

	return (
		<div className="space-y-4">
			<Button 
				onClick={handleConnect}
				disabled={isConnecting}
				className="w-full"
			>
				{isConnecting ? 'Connecting...' : 'Connect LibBurner Wallet'}
			</Button>
			{error && (
				<div className="text-red-500 text-sm text-center">
					{error}
				</div>
			)}
		</div>
	);
}

export function SignUpButton() {
	return (
		<LibBurnerConnectButton />
	);
}
