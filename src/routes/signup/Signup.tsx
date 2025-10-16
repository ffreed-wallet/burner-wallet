/* eslint-disable @typescript-eslint/no-unused-vars */

import React from 'react';
import { SignUpButton } from '@/components/SignUpButton/SignUpButton';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';

export default function Component() {
	const navigate = useNavigate();

	return (
		<div className="items flex h-screen min-h-screen flex-col justify-center space-y-4">
			<Toaster position="top-right" />
			<div className="flex flex-col items-center space-y-2">
				<img
					alt="Logo"
					// ADD green dropshadow using tailwind
					className="  
					before:left-0
 					before:top-0
 					before:-z-10
 					before:h-full
 							 before:w-full
 							 before:bg-gradient-to-r
 							 before:from-[#00ff00]
 							 before:to-[#00ff00]
 							 before:blur-[5vw]"
					height="150"
					src="/ffreed.svg"
					width="150"
				/>
				<div className="flex flex-col items-center space-y-2">
					<h1 className="text-3xl font-bold tracking-tighter">Welcome to FFreed Wallet</h1>
					<p className="text-sm font-medium tracking-wide text-gray-500 dark:text-gray-400">
						Let's get started by creating an account or signing in
					</p>
				</div>
			</div>
			<div className="w-full max-w-sm items-stretch self-center px-4">
				<SignUpButton />
			</div>
		</div>
	);
}
