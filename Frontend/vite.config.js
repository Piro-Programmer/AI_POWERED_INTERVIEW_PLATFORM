import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin /api in development, mirroring the vercel.json rewrite
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
