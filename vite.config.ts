import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain static build. Nothing host-specific lives here — `dist/` drops onto
// Cloudflare Pages, Netlify, GitHub Pages, or an S3 bucket unchanged.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
});
