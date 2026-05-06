import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir:      'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/invoices': 'http://localhost:3000',
      '/health':   'http://localhost:3000',
      '/uris':     'http://localhost:3000',
      '/address':  'http://localhost:3000',
      '/merchant': 'http://localhost:3000',
    },
  },
});
