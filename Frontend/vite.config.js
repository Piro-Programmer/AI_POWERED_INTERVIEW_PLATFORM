import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Stamps the built page with the commit it came from, so the CD pipeline can
// confirm the tested commit is what's live (Vercel sets VERCEL_GIT_COMMIT_SHA).
const appVersion = () => ({
  name: 'app-version',
  transformIndexHtml: (html) =>
    html.replace(
      '</head>',
      `  <meta name="app-version" content="${process.env.VERCEL_GIT_COMMIT_SHA || 'dev'}" />\n  </head>`
    ),
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), appVersion()],
  server: {
    // Same-origin /api in development, mirroring the vercel.json rewrite
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
