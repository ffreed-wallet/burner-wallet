import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Allow ngrok / other HTTPS tunnel hosts for phone testing.
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    // libhalo/libburner predate bundler-free ESM and expect Node globals
    // (Buffer/global/process). Same setup as the old ff freed-wallet app.
    nodePolyfills({
      include: ['buffer', 'process', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // we ship our own public/manifest.webmanifest
      workbox: {
        navigateFallbackDenylist: [/^\/manifest/, /^\/icons/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(png|svg|jpg|jpeg|webp|woff2?)$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'assets', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
})
