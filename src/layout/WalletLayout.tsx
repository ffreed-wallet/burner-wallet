import React, { useEffect } from 'react';
import BottomBar from '@/components/BottomBar/BottomBar';
import { Toaster } from '@/components/ui/sonner';
import { Outlet, useNavigate, useLocation } from 'react-router';

export default function WalletLayout() {
	const navigate = useNavigate();
	const location = useLocation();

	useEffect(() => {
		// Check if wallet is stored in localStorage
		const storedAddress = localStorage.getItem('libburner_address');
		const isConnected = localStorage.getItem('libburner_connected') === 'true';
		
		// If no wallet is stored and user is trying to access wallet pages, redirect to signup
		if (!storedAddress || !isConnected) {
			if (location.pathname !== '/signup' && location.pathname !== '/') {
				navigate('/signup');
			}
		}
	}, [navigate, location.pathname]);

	return (
		<>
			<Toaster position="top-right" />
			<div className="flex h-screen flex-col overflow-hidden">
				<div className="flex-grow overflow-x-hidden">
					<Outlet />
				</div>
				<BottomBar />
			</div>
		</>
	);
}
