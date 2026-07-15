import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SPA classique. En dev, Vite proxy les appels /api et fichiers agent vers
// le serveur Express (port 4173). En prod, Express sert le build.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // L'entree (boutique) reste index-*. Tout chunk async (le banc d'essai
        // charge en lazy) est nomme panel-* : le serveur public ne le sert pas.
        entryFileNames: 'assets/index-[hash].js',
        chunkFileNames: 'assets/panel-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4173',
      '/robots.txt': 'http://localhost:4173',
      '/llms.txt': 'http://localhost:4173',
      '/.well-known': 'http://localhost:4173',
    },
  },
});
