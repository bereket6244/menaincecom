import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.VITE_APP_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  modulePreload: {
    polyfill: false,
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the stable React/router core in its own chunk so it stays
        // cached across app deploys (only the app chunk changes each release).
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
