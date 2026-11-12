/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app that opens full screen and works with no internet (e.g. at the demo venue).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NadiSense',
        short_name: 'NadiSense',
        description: 'Companion app for the NadiSense ring: pulse screening that works offline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#050506',
        theme_color: '#050506',
        categories: ['health', 'medical'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Fonts come from Google; keep them once loaded so the offline app looks the same.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Firebase changes rarely; a separate chunk stays cached across app updates.
      output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] } },
    },
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
