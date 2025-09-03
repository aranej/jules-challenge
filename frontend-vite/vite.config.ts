import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests (e.g., /api/*, /auth/*)
      '/api': {
        target: 'http://localhost:3000', // Your backend server
        changeOrigin: true,
        // No rewrite needed if backend expects /api prefix
      },
      '/auth': {
        target: 'http://localhost:3000', // Your backend server
        changeOrigin: true,
        // No rewrite needed if backend expects /auth prefix
      },
      // Proxy WebSocket requests (e.g., for path /ws)
      '/ws': {
        target: 'ws://localhost:3000', // Your backend WebSocket server
        ws: true, // Enable WebSocket proxying
        changeOrigin: true, // Important for WebSocket proxying if backend is on a different host/port
      },
    },
  },
})
