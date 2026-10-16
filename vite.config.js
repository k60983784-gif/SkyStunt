import { defineConfig } from 'vite';

// The client bundles the shared simulation code from ../shared (same files the server uses).
export default defineConfig({
  root: '.',
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts: true },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 2000, target: 'es2020', rollupOptions: { input: { main: 'index.html', library: 'library.html' } } },
});
