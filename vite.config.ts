import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

/*
 * Modes:
 *  - default  → http://localhost:5199, exposed on the LAN too (fast desktop use, in-session preview)
 *  - mobile   → same but HTTPS with a self-signed cert (`npm run mobile`): phones need a
 *               secure context for mic / speech recognition. Accept the cert warning once.
 */
export default defineConfig(({ mode }) => ({
  // Relative base: the same build works at the domain root, under a sub-path
  // (GitHub Pages /repo/), and when opened from a LAN address.
  base: './',
  plugins: [react(), ...(mode === 'mobile' ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5199,
    strictPort: true,
    host: true, // reachable from phones on the same Wi-Fi
  },
  preview: {
    port: 5199,
    strictPort: true,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'three-spritetext'],
          graph: ['react-force-graph-3d', 'react-force-graph-2d'],
          vendor: ['react', 'react-dom', 'zustand', 'framer-motion', 'date-fns'],
        },
      },
    },
  },
}));
