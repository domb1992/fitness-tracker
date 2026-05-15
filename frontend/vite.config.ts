import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import pkg from './package.json';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // SW registration handled by the PWAUpdatePrompt component via useRegisterSW
      injectRegister: null,
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'pwa-64x64.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        name: 'FitTrack',
        short_name: 'FitTrack',
        description: 'Your personal fitness tracker — outlift yesterday',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0B0C0E',
        background_color: '#0B0C0E',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache all static build output
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],

        runtimeCaching: [
          {
            // Supabase — never cache: auth tokens, real-time data, user records
            urlPattern: ({ url }) =>
              url.hostname.includes('supabase.co') ||
              url.hostname.includes('supabase.in'),
            handler: 'NetworkOnly',
          },
          {
            // Google Fonts CSS — stale-while-revalidate: fast load, stays fresh
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts woff2 files — cache-first, 1 year (immutable CDN assets)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // SPA: all navigation falls back to the cached shell when offline
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,        // explicit API routes
          /^\/\.netlify\//,  // Netlify internals
          /^\/_\//,          // underscore-prefixed paths
        ],

        // Remove caches from previous SW versions on activation
        cleanupOutdatedCaches: true,
      },

      devOptions: {
        // Keep false in dev to avoid HMR conflicts.
        // To test SW: `npm run build && npm run preview`
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: { port: 5173 },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
