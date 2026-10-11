import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
const base = process.env.PAGES_BASE_PATH || '/chelsea-par-test-web/';
export default defineConfig({
  root: resolve('preview'), base, publicDir: resolve('public'), plugins: [react()],
  define: { __PAGES_PREVIEW__: 'true', __PAGES_BASE_PATH__: JSON.stringify(base.replace(/\/$/, '')) },
  build: { outDir: resolve('pages-dist'), emptyOutDir: true },
});
