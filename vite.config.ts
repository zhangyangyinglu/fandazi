import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

const ICON_VERSION = '20260803-logo-2'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'favicon.png',
        'favicon.svg',
        'apple-touch-icon.png',
        'brand-logo.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
      ],
      manifest: {
        name: '饭搭子 — 家庭做饭助手',
        short_name: '饭搭子',
        description: 'GitHub 开源型 Web 工具版家庭做饭助手',
        lang: 'zh-CN',
        id: '/',
        scope: '/',
        theme_color: '#f7f0e5',
        background_color: '#f7f0e5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: `/icons/icon-192.png?v=${ICON_VERSION}`, sizes: '192x192', type: 'image/png' },
          { src: `/icons/icon-512.png?v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png' },
          { src: `/icons/icon-maskable-512.png?v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3300,
  },
})
