import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Bible Study Annotation App — Mobile
// Cache-first scripture, network-first sync (PRD §3, §9 Offline)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:58128'

  return {
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
      host: true,
      // Proxy all API and auth calls through the Vite dev server so the browser
      // never makes a cross-origin request. This removes the CORS constraint
      // entirely during local development (the proxy runs server-side).
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false
        },
        '/auth': {
          target: apiTarget,
          changeOrigin: true,
          secure: false
        }
      }
    },
    define: {
      'global.crypto': 'globalThis.crypto'
    },
    test: {
      environment: 'jsdom'
    }
  }
})
