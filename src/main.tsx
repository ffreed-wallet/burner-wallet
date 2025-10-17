/* eslint-disable @typescript-eslint/no-non-null-assertion */
import 'bootstrap-icons/font/bootstrap-icons.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import '@/index.css';
import WalletLayout from '@/layout/WalletLayout.tsx';
import { ThemeProvider } from '@/providers/theme.tsx';
import { ChainProvider } from '@/providers/ChainProvider';
import { LibBurnerProvider } from '@/providers/LibBurnerProvider';
import { WalletConnectProvider } from '@/providers/WalletConnectProvider';
import ErrorPage from '@/routes/error/error-page.tsx';
import Home from '@/routes/Home/Home.tsx';
import Signup from '@/routes/signup/Signup.tsx';
import Send from '@/routes/send/Send.tsx';
import Swap from '@/routes/swap/Swap.tsx';
import Transactions from '@/routes/transactions/Transactions.tsx';
import Settings from './routes/settings/Settings';

const router = createBrowserRouter([
	{
		path: '/',
		errorElement: <ErrorPage />,
		children: [
			{
				element: <WalletLayout />,
				children: [
					{
						path: '/send',
						element: <Send />
					},
					{
						path: '/swap',
						element: <Swap />
					},
					{
						path: '/transactions',
						element: <Transactions />
					},
					{
						path: '/settings',
						element: <Settings />
					},
					{
						path: '/search',
						element: <Home />
					},
					{
						path: '/home',
						element: <Home />
					}
				]
			},
			{
				path: '/signup',
				element: <Signup />
			},
			{
				path: '/',
				element: <Signup />
			}
		]
	}
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
			<ChainProvider>
				<LibBurnerProvider>
					<WalletConnectProvider>
						<RouterProvider router={router} />
						<Analytics />
					</WalletConnectProvider>
				</LibBurnerProvider>
			</ChainProvider>
		</ThemeProvider>
	</React.StrictMode>
);
