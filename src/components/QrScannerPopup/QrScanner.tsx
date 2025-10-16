import { useEffect, useRef, useState } from 'react';

import QrScanner from 'qr-scanner';
import QrFrame from '../assets/qr-frame.svg';

interface QrReaderProps {
	onError?: (error: string) => void;
}

const QrReader = ({ onError }: QrReaderProps) => {
	const scanner = useRef<QrScanner>();
	const videoEl = useRef<HTMLVideoElement>(null);
	const qrBoxEl = useRef<HTMLDivElement>(null);
	const [qrOn, setQrOn] = useState<boolean>(true);

	const [scannedResult, setScannedResult] = useState<string | undefined>('');

	const onScanSuccess = (result: QrScanner.ScanResult) => {
		setScannedResult(result?.data);
	};

	const onScanFail = (err: string | Error) => {
		console.log(err);
	};

	useEffect(() => {
		if (videoEl?.current && !scanner.current) {
			scanner.current = new QrScanner(videoEl?.current, onScanSuccess, {
				onDecodeError: onScanFail,
				preferredCamera: 'environment',
				highlightScanRegion: true,
				highlightCodeOutline: true,
				overlay: qrBoxEl?.current || undefined
			});

			scanner?.current
				?.start()
				.then(() => setQrOn(true))
				.catch(err => {
					if (err) setQrOn(false);
				});
		}

		return () => {
			if (!videoEl?.current) {
				scanner?.current?.stop();
			}
		};
	}, []);

	useEffect(() => {
		if (!qrOn && onError) {
			onError('Camera is blocked or not accessible. Please allow camera in your browser permissions and reload.');
		}
	}, [qrOn, onError]);

	return (
		<div className="qr-reader">
			<video ref={videoEl}></video>
			<div ref={qrBoxEl} className="qr-box">
				<img src={QrFrame} alt="Qr Frame" width={256} height={256} className="qr-frame" />
			</div>

			{/* Show Data Result if scan is success */}
			{scannedResult && (
				<p
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						zIndex: 99999,
						color: 'white'
					}}
				>
					Scanned Result: {scannedResult}
				</p>
			)}
		</div>
	);
};

export default QrReader;
