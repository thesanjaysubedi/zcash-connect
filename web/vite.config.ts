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
    proxy: (() => {
      const target = 'http://localhost:3000';
      // Suppress ECONNREFUSED noise during the dev-mode startup race
      // where Vite is ready (~300ms) but Express is still gRPC-handshaking
      // with lightwalletd (~6s). The frontend's polling already handles
      // the failure gracefully — we just don't want it cluttering the log.
      const configure = (proxy: { on: (e: string, cb: (err: NodeJS.ErrnoException) => void) => void }) => {
        proxy.on('error', (err) => {
          if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') return;
          console.error('[vite proxy]', err);
        });
      };
      return {
        '/invoices': { target, configure },
        '/health':   { target, configure },
        '/uris':     { target, configure },
        '/address':  { target, configure },
        '/merchant': { target, configure },
      };
    })(),
  },
});
