import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Component() {
	const navigate = useNavigate();
	const location = useLocation();
	const [path, setPath] = useState('');
	const [isPWA, setIsPWA] = useState(false);

	useEffect(() => {
		setPath(location.pathname);
	}, [location]);

	useEffect(() => {
		const inStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
		// iOS Safari adds navigator.standalone when launched from home screen
		const inIOSStandalone = (window.navigator as any).standalone === true;
		setIsPWA(Boolean(inStandalone || inIOSStandalone));
	}, []);

	return (
		<nav
			className={`font-large bg-background fixed bottom-0 left-0 right-0 mx-auto grid   ${isPWA ? 'h-24 pb-6' : 'h-12'} w-full max-w-full grid-cols-4 items-center justify-between overflow-hidden`}
		>
			<Button
				aria-label="Home"
				className="bg-secondary-bg flex h-full flex-1 flex-col items-center justify-center rounded-none text-xs min-w-0"
				variant="secondary"
				onClick={() => {
					navigate('/home');
				}}
			>
				<HomeIcon className="h-full w-full" selected={path == '/home'} />
			</Button>
			<Button
				aria-label="Send"
				className="bg-secondary-bg flex h-full flex-1 flex-col items-center justify-center rounded-none text-xs min-w-0"
				variant="secondary"
				onClick={() => {
					navigate('/send');
				}}
			>
				<SendIcon className="h-full w-full" selected={path == '/send'} />
			</Button>
			<Button
				aria-label="Transactions"
				className="bg-secondary-bg flex h-full flex-1 flex-col items-center justify-center rounded-none text-xs min-w-0"
				variant="secondary"
				onClick={() => {
					navigate('/transactions');
				}}
			>
				<HistoryIcon className="h-full w-full" selected={path == '/transactions'} />
			</Button>
			<Button
				aria-label="Account"
				variant="secondary"
				className="bg-secondary-bg flex h-full flex-1 flex-col items-center justify-center rounded-none text-xs min-w-0"
				onClick={() => {
					navigate('/settings');
				}}
			>
				<UserIcon className="h-full w-full" selected={path == '/settings'} />
			</Button>
		</nav>
	);
}

function HomeIcon(props) {
	if (props.selected)
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-house-heart"
				viewBox="0 0 16 16"
			>
				<path d="m8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z" />

				<path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z" />
			</svg>
		);
	else {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-house"
				viewBox="0 0 16 16"
			>
				<path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5z" />
			</svg>
		);
	}
}

// function SearchIcon(props) {
// 	if (props.selected)
// 		return (
// 			<svg
// 				xmlns="http://www.w3.org/2000/svg"
// 				width="16"
// 				height="16"
// 				fill="currentColor"
// 				className="bi bi-search-heart"
// 				viewBox="0 0 16 16"
// 			>
// 				<path d="M6.5 4.482c1.664-1.673 5.825 1.254 0 5.018-5.825-3.764-1.664-6.69 0-5.018" />
// 				<path d="M13 6.5a6.47 6.47 0 0 1-1.258 3.844q.06.044.115.098l3.85 3.85a1 1 0 0 1-1.414 1.415l-3.85-3.85a1 1 0 0 1-.1-.115h.002A6.5 6.5 0 1 1 13 6.5M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11" />
// 			</svg>
// 		);
// 	else {
// 		return (
// 			<svg
// 				xmlns="http://www.w3.org/2000/svg"
// 				width="16"
// 				height="16"
// 				fill="currentColor"
// 				className="bi bi-search"
// 				viewBox="0 0 16 16"
// 			>
// 				<path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
// 			</svg>
// 		);
// 	}
// }

function HistoryIcon(props) {
	if (props.selected)
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-clock-fill"
				viewBox="0 0 16 16"
			>
				<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z" />
			</svg>
		);
	else {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-clock"
				viewBox="0 0 16 16"
			>
				<path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z" />
				<path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0" />
			</svg>
		);
	}
}


function SendIcon(props) {
	if (props.selected)
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-send-fill"
				viewBox="0 0 16 16"
			>
				<path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471Z" />
			</svg>
		);
	else {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-send"
				viewBox="0 0 16 16"
			>
				<path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z" />
			</svg>
		);
	}
}

function UserIcon(props) {
	if (props.selected)
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-person-hearts"
				viewBox="0 0 16 16"
			>
				<path
					fillRule="evenodd"
					d="M11.5 1.246c.832-.855 2.913.642 0 2.566-2.913-1.924-.832-3.421 0-2.566M9 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0m-9 8c0 1 1 1 1 1h10s1 0 1-1-1-4-6-4-6 3-6 4m13.5-8.09c1.387-1.425 4.855 1.07 0 4.277-4.854-3.207-1.387-5.702 0-4.276ZM15 2.165c.555-.57 1.942.428 0 1.711-1.942-1.283-.555-2.281 0-1.71Z"
				/>
			</svg>
		);
	else {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				className="bi bi-person"
				viewBox="0 0 16 16"
			>
				<path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
			</svg>
		);
	}
}
