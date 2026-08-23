import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      manifest: {
        name: '忆读',
        short_name: '忆读',
        description: '上传 HTML 文档，隐藏重点内容，辅助记忆与复习',
        theme_color: '#F9F7F2',
        background_color: '#F9F7F2',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: './',
        icons: [
          { src: '/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
