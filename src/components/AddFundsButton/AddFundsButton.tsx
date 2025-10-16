import React from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';

export default function Component({ className, variant, ...props }) {
	return (
		<Drawer>
			<DrawerTrigger asChild>
				<Button variant={variant} className={'w-full ' + className}>
					Add Funds
				</Button>
			</DrawerTrigger>
			<DrawerContent className="min-h-96">
				<div className="mx-auto flex w-full max-w-sm flex-col">
					<div className="p-0 pb-10">
						<DrawerHeader className="sf-eter">
							<DrawerTitle>Add Funds</DrawerTitle>
							<DrawerClose />
						</DrawerHeader>
						<div className="flex flex-col gap-2 space-y-4 border p-5">
							<div className="flex items-center ">
								<img
									src="https://docs.ramp.network/img/logo-1.svg"
									className="mr-4 h-10 w-10 rounded-full"
									alt="Image"
								/>
								<div className="flex grow flex-row content-center items-baseline justify-between">
									<div className="text-2xl">Ramp.network</div>
									<div className="text-end text-3xl">
										<a className="bi bi-arrow-up-right" href={''} target="_blank" />
									</div>
								</div>
							</div>
							<div className="flex flex-col">
								<p className="text-l">Cards, Banks and International Options</p>
								<p className="text-l">Ramp.network</p>
							</div>
						</div>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
