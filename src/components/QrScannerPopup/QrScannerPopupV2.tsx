import React, { useState, useRef, useEffect } from 'react';
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
import { QrCode, Camera, Copy, ExternalLink, Send, Wallet } from 'lucide-react';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';
import { useWalletConnect } from '@/providers/WalletConnectProvider';

export default function QrScannerPopupV2() {
	const [open, setOpen] = useState(false);
	const [scannedResult, setScannedResult] = useState<string | undefined>('');
	const [isScanning, setIsScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	
	const navigate = useNavigate();
	const { connect } = useWalletConnect();

	const startScanning = async () => {
		console.log('Starting camera...');
		
		try {
			setError(null);
			setIsScanning(true);

			// Request camera access
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment', // Use back camera
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			});

			setStream(mediaStream);

			if (videoRef.current) {
				videoRef.current.srcObject = mediaStream;
				videoRef.current.play();
				
				// Start QR code detection after video starts playing
				videoRef.current.onloadedmetadata = () => {
					startQRDetection();
				};
			}
		} catch (err) {
			console.error('Camera error:', err);
			setError(`Camera access denied: ${err instanceof Error ? err.message : 'Unknown error'}`);
			setIsScanning(false);
		}
	};

	const startQRDetection = () => {
		if (!videoRef.current || !canvasRef.current) return;

		intervalRef.current = setInterval(() => {
			if (videoRef.current && canvasRef.current) {
				const canvas = canvasRef.current;
				const video = videoRef.current;
				const context = canvas.getContext('2d');

				if (context && video.videoWidth > 0 && video.videoHeight > 0) {
					// Set canvas size to match video
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;

					// Draw video frame to canvas
					context.drawImage(video, 0, 0, canvas.width, canvas.height);

					// Get image data for QR detection
					const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
					
					// Simple QR code detection (you might want to use a more sophisticated library)
					// For now, we'll use a basic pattern detection
					detectQRCode(imageData);
				}
			}
		}, 100); // Check every 100ms
	};

	const detectQRCode = (imageData: ImageData) => {
		try {
			// Use jsQR for actual QR code detection
			const code = jsQR(imageData.data, imageData.width, imageData.height);
			
			if (code) {
				console.log('QR Code detected:', code.data);
				handleScannedData(code.data);
			}
		} catch (err) {
			console.error('QR detection error:', err);
		}
	};

	const handleScannedData = async (data: string) => {
		setIsProcessing(true);
		stopScanning();
		
		try {
			// Check if it's an Ethereum address
			if (data.startsWith('0x') && data.length === 42) {
				console.log('Ethereum address detected:', data);
				setScannedResult(data);
				// Navigate to send page with the address
				navigate(`/send?address=${encodeURIComponent(data)}`);
				setOpen(false);
				return;
			}
			
			// Check if it's a WalletConnect URL
			if (data.startsWith('wc:')) {
				console.log('WalletConnect URL detected:', data);
				setScannedResult(data);
				// Connect to WalletConnect
				await connect(data);
				setOpen(false);
				return;
			}
			
			// Check if it's a wallet deep link with WalletConnect URI (MetaMask, 1inch, etc.)
			if (data.includes('metamask.app.link/wc') || data.includes('metamask.app.link/dapp') || 
				data.includes('wallet.1inch.io/wc') || data.includes('wallet.1inch.io/dapp')) {
				console.log('Wallet deep link detected:', data);
				try {
					const url = new URL(data);
					const uriParam = url.searchParams.get('uri');
					if (uriParam) {
						const decodedUri = decodeURIComponent(uriParam);
						console.log('Extracted WalletConnect URI:', decodedUri);
						if (decodedUri.startsWith('wc:')) {
							setScannedResult(decodedUri);
							await connect(decodedUri);
							setOpen(false);
							return;
						}
					}
				} catch (urlError) {
					console.warn('Failed to parse wallet URL:', urlError);
				}
			}
			
			// For other data, just show the result
			setScannedResult(data);
		} catch (err) {
			console.error('Error handling scanned data:', err);
			setError(`Failed to process scanned data: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			setIsProcessing(false);
		}
	};

	const stopScanning = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		if (stream) {
			stream.getTracks().forEach(track => track.stop());
			setStream(null);
		}

		setIsScanning(false);
	};

	const copyToClipboard = async () => {
		if (scannedResult) {
			try {
				await navigator.clipboard.writeText(scannedResult);
			} catch (err) {
				console.error('Failed to copy to clipboard:', err);
			}
		}
	};

	const openInExplorer = () => {
		if (scannedResult) {
			if (scannedResult.startsWith('0x') && scannedResult.length === 42) {
				window.open(`https://etherscan.io/address/${scannedResult}`, '_blank');
			} else {
				window.open(scannedResult, '_blank');
			}
		}
	};

	useEffect(() => {
		if (open && !scannedResult) {
			const timer = setTimeout(() => {
				startScanning();
			}, 300);
			return () => clearTimeout(timer);
		} else if (!open) {
			stopScanning();
			setScannedResult('');
			setError(null);
		}
	}, [open]);

	useEffect(() => {
		return () => {
			stopScanning();
		};
	}, []);

	return (
		<Drawer
			open={open}
			onOpenChange={setOpen}
		>
			<DrawerTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="h-10 w-10"
				>
					<QrCode className="h-4 w-4" />
				</Button>
			</DrawerTrigger>
			<DrawerContent className="h-2/3 flex flex-col">
				<DrawerHeader className="flex-shrink-0">
					<DrawerTitle>Scan QR Codes</DrawerTitle>
					<DrawerDescription>Wallet Address/WalletConnect</DrawerDescription>
				</DrawerHeader>
				
				<div className="flex-1 p-4 overflow-hidden">
					{!scannedResult ? (
						<div className="relative h-full">
							{error ? (
								<div className="flex h-full items-center justify-center">
									<div className="text-center">
										<Camera className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
										<p className="text-red-600 mb-2">{error}</p>
										<Button onClick={() => startScanning()} variant="outline">
											Try Again
										</Button>
									</div>
								</div>
							) : !isScanning ? (
								<div className="flex h-full items-center justify-center">
									<div className="text-center">
										<Camera className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
										<p className="text-muted-foreground mb-4">Camera ready</p>
										<Button onClick={() => startScanning()} variant="outline">
											Start Camera
										</Button>
									</div>
								</div>
							) : (
								<div className="relative h-full max-h-96">
									<video
										ref={videoRef}
										className="h-full w-full rounded-lg object-cover"
										playsInline
										webkit-playsinline="true"
										muted
										autoPlay
									/>
									<canvas
										ref={canvasRef}
										className="hidden"
									/>
									<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
										<div className="text-center text-white">
											<Camera className="mx-auto mb-2 h-8 w-8 animate-pulse" />
											<p>Scanning...</p>
											<div className="mt-4 w-48 h-48 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
												<p className="text-sm">Point camera at QR code</p>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="space-y-4">
							{isProcessing ? (
								<div className="flex items-center justify-center py-8">
									<div className="text-center">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
										<p className="text-muted-foreground">Processing...</p>
									</div>
								</div>
							) : (
								<>
									<div className="rounded-lg border p-4">
										<h3 className="font-medium mb-2">Scanned Result:</h3>
										<p className="font-mono text-sm break-all bg-muted p-2 rounded">
											{scannedResult}
										</p>
									</div>
									
									{/* Show specific actions based on data type */}
									{scannedResult?.startsWith('0x') && scannedResult.length === 42 ? (
										<div className="space-y-2">
											<div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
												<Send className="h-4 w-4 text-blue-600" />
												<span className="text-sm text-blue-800">Ethereum Address Detected</span>
											</div>
											<Button 
												onClick={() => navigate(`/send?address=${encodeURIComponent(scannedResult)}`)} 
												className="w-full"
											>
												<Send className="h-4 w-4 mr-2" />
												Go to Send Page
											</Button>
										</div>
									) : scannedResult?.startsWith('wc:') ? (
										<div className="space-y-2">
											<div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
												<Wallet className="h-4 w-4 text-purple-600" />
												<span className="text-sm text-purple-800">WalletConnect URL Detected</span>
											</div>
											<Button 
												onClick={() => connect(scannedResult)} 
												className="w-full"
											>
												<Wallet className="h-4 w-4 mr-2" />
												Connect to dApp
											</Button>
										</div>
									) : (scannedResult?.includes('metamask.app.link') || scannedResult?.includes('wallet.1inch.io')) ? (
										<div className="space-y-2">
											<div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
												<Wallet className="h-4 w-4 text-orange-600" />
												<span className="text-sm text-orange-800">Wallet Deep Link Detected</span>
											</div>
											<p className="text-xs text-muted-foreground">
												This appears to be a wallet deep link. Try scanning a direct WalletConnect QR code instead.
											</p>
										</div>
									) : null}
									
									<div className="flex gap-2">
										<Button onClick={copyToClipboard} variant="outline" className="flex-1">
											<Copy className="h-4 w-4 mr-2" />
											Copy
										</Button>
										<Button onClick={openInExplorer} variant="outline" className="flex-1">
											<ExternalLink className="h-4 w-4 mr-2" />
											Open
										</Button>
									</div>
								</>
							)}
						</div>
					)}
				</div>

				<DrawerFooter className="flex-shrink-0">
					{scannedResult ? (
						<div className="flex gap-2">
							<Button 
								onClick={() => {
									setScannedResult('');
									startScanning();
								}} 
								variant="outline"
								className="flex-1"
							>
								Scan Again
							</Button>
							<DrawerClose asChild>
								<Button className="flex-1">Close</Button>
							</DrawerClose>
						</div>
					) : (
						<DrawerClose asChild>
							<Button variant="outline">Cancel</Button>
						</DrawerClose>
					)}
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
