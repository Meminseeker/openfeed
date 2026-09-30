import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8800',  // default was 8000
        changeOrigin: true,
        // TikTok streams can be slow to start (yt-dlp resolution + CDN)
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
    },
  },
})
