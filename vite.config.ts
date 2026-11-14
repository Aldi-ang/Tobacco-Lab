import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'pwa-safe-dev-sw',
        enforce: 'pre',
        apply: 'serve',
        resolveId(id) {
          if (id === '/@vite-plugin-pwa/pwa-entry-point-loaded') {
            return '\0pwa-safe-dev-sw';
          }
          return null;
        },
        load(id) {
          if (id === '\0pwa-safe-dev-sw') {
            return `export default function registerDevSW() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', { scope: '/', type: 'classic' }).catch(() => {});
  }
}`;
          }
          return null;
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'awd-logo.png', 'apple-touch-icon-awd-black.png'],
        manifest: {
          id: '/',
          name: 'Tobacco Lab — Sistem Racikan & HPP Tembakau',
          short_name: 'Tobacco Lab',
          description:
            'Sistem manajemen racikan tembakau antardaerah, kalkulator HPP akurat, nomor seri pabrik, dan arsip gulungan sampel.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192-awd-black.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512-awd-black.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512-awd-black.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallbackDenylist: [/^\/__/, /^\/api/],
        },
        devOptions: {
          enabled: true,
          suppressWarnings: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
