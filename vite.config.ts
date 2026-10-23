import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['apple-touch-icon.png'],
    manifest: {
      name: 'Student Productivity', short_name: 'Productivity',
      display: 'standalone', start_url: '/', scope: '/', orientation: 'portrait',
      theme_color: '#ffffff', background_color: '#ffffff',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico}'], navigateFallback: '/index.html', cleanupOutdatedCaches: true },
  })],
})
