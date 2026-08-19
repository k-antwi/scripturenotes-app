import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Bible Study Annotation App — Mobile
// Cache-first scripture, network-first sync (PRD §3, §9 Offline)
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bible Study',
        short_name: 'BibleStudy',
        description: 'Read, highlight, and annotate scripture — online or off.',
        theme_color: '#1B2A4A',
        background_color: '#FAF6EE',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Scripture text: cache-first (PRD §3 Service Worker / PWA)
        runtimeCaching: [
          {
            urlPattern: /\/api\/passages\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'scripture-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /\/api\/annotations/,
            handler: 'NetworkFirst',
            options: { cacheName: 'annotation-sync-cache' }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: true
  },
  test: {
    environment: 'jsdom'
  }
})
