import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app targets its own origin by default (see src/App.tsx), so the dev
// server needs the same /api proxy that scripts/serve-ui.mjs provides for the
// built bundle — otherwise `npm run dev` would answer API calls from Vite.
// Override the upstream with TRUEFORGE_URL when TrueForge runs elsewhere.
const target = process.env.TRUEFORGE_URL ?? 'http://[::1]:8790'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target, changeOrigin: true },
    },
  },
})
