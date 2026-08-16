import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so the build config stays a plain static
// build with nothing test- or host-specific in it.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
