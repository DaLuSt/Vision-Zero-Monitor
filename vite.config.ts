/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The default "./" produces relative URLs, so one build works on a GitHub project site
// under any repository name, on a custom domain, or from a sub-folder. Routing is
// hash-based, so the page itself never needs to know its path. Set VITE_BASE_PATH
// only to force an absolute base.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
