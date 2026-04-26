import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',  // Bind to all interfaces → accessible from phone on same Wi-Fi
    port: 5173,
    https: true,       // Required for camera + microphone on non-localhost origins
  },
  plugins: [
    basicSsl(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Krishi Sakhi',
        short_name: 'Sakhi',
        description: 'AI agricultural advisor for smallholder farmers',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/(ref_crops|ref_locations)/,
            handler: 'CacheFirst',
            options: { cacheName: 'supabase-ref-data', expiration: { maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
})
