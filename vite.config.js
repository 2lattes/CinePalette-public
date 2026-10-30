import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Multi-page build: one entry per locale.
 * Deployed URLs are unchanged: /index.html (fr) and /en.html (en).
 * Static assets (film palettes, brand assets, PWA manifest) live in /public
 * and are copied verbatim to the dist root, preserving all existing paths.
 */
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        fr: fileURLToPath(new URL('./index.html', import.meta.url)),
        en: fileURLToPath(new URL('./en.html', import.meta.url)),
      },
    },
  },
});
