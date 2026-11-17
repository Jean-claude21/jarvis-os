import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The v3 client, served by the API at /v3 (v3 D17). In development the API runs beside it.
const api = process.env.JARVIS_API ?? 'http://localhost:3701';
export default defineConfig({
  base: '/v3/',
  plugins: [react(), tailwind()],
  server: {
    port: 5173,
    proxy: { '/api': api, '/auth': api, '/connexion': api },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
