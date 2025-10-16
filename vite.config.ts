import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	plugins: [
		react(),
		nodePolyfills({
			include: ['buffer', 'process', 'util'],
			globals: {
				Buffer: true,
				global: true,
				process: true,
			},
		})
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	},
	server: {
		host: true,
		allowedHosts: [
			'.trycloudflare.com',
			'.loca.lt',
			'9c408eb8a18d.ngrok-free.app',
			'.ngrok.io',
			'.ngrok-free.app'
		]
	}
});
