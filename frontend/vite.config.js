import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function isPrivateIpv4(hostname) {
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  )
}

function resolveBackendTarget(configured) {
  const fallback = 'http://127.0.0.1:8000'
  if (!configured) return fallback

  try {
    const parsed = new URL(configured)
    const port = parsed.port || '8000'

    // In local/LAN dev the backend runs on this same machine, so avoid stale
    // Wi-Fi IPs from `.env` and proxy to loopback instead.
    if (LOOPBACK_HOSTS.has(parsed.hostname) || isPrivateIpv4(parsed.hostname)) {
      return `http://127.0.0.1:${port}`
    }

    return configured.replace(/\/$/, '')
  } catch {
    return fallback
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = resolveBackendTarget((env.VITE_API_BASE_URL || '').trim())

  return {
    server: {
      host: '0.0.0.0',  // Bind to all interfaces → accessible from phone on same Wi-Fi
      port: 5173,
      https: true,       // Required for camera + microphone on non-localhost origins
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
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
  }
})
