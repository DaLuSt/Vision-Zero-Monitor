/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE_PATH lets the same build work on a GitHub project site
// (e.g. "/eu-road-safety-observatory/") or a custom domain ("/").
// The default "./" produces relative URLs that work in both cases.
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
