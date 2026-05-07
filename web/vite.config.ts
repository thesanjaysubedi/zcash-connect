import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath, URL } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  // Wire PostCSS + Tailwind inline with an explicit config path so the
  // tailwind config file is resolved relative to web/, not the cwd.
  // Bare './index.html' / './src/**/*.{ts,tsx}' content paths in the
  // tailwind config now resolve correctly because Tailwind's content
  // scanner uses the config file's directory as its base.
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: `${here}/tailwind.config.js` }),
        autoprefixer(),
      ],
    },
  },
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
