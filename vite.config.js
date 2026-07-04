import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  // client/public is served at / (audio, config, assets/images all live here)
  publicDir: path.resolve(__dirname, 'client/public'),
  server: {
    port: 3000,
    // Ensure assets are served with correct MIME types
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'client/dist'),
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Pin the dep-scan entry to the source index.html, not the dist output.
    // Without this, Vite scans client/dist/index.html which references
    // already-bundled assets and triggers a spurious esbuild failure.
    entries: ['index.html'],
  },
});
