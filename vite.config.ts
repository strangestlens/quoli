import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` serves over TLS with a self-signed certificate. The
// Clipboard API — and any other secure-context-only browser feature — is
// unavailable over plain http on a LAN address, so testing those on a phone
// needs this. Production is HTTPS anyway, so it also matches what ships.
const useHttps = process.env.QUOLI_HTTPS === '1';

// Plain static build. Nothing host-specific lives here — `dist/` drops onto
// Cloudflare Pages, Netlify, GitHub Pages, or an S3 bucket unchanged.
export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    // Listen on the LAN, not just localhost, so a phone on the same Wi-Fi can
    // reach the dev server. Vite prints the address as "Network:" on startup.
    host: true,
  },
  build: {
    target: 'es2022',
  },
});
