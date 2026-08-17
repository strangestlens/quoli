import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain static build. Nothing host-specific lives here — `dist/` drops onto
// Cloudflare Pages, Netlify, GitHub Pages, or an S3 bucket unchanged.
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on the LAN, not just localhost, so a phone on the same Wi-Fi can
    // reach the dev server. Vite prints the address as "Network:" on startup.
    host: true,
  },
  build: {
    target: 'es2022',
  },
});
