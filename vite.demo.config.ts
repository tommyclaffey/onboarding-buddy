// Static portfolio demo build → GitHub Pages (tommyclaffey.github.io/onboarding-buddy-demo/).
// The server's routes run in the browser on sql.js; node: built-ins are swapped for small shims.
// Build: npm run build:demo   Output: dist-demo/
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const shim = (f: string) => fileURLToPath(new URL(`./src/demo/shims/${f}`, import.meta.url));

export default defineConfig({
  base: '/onboarding-buddy-demo/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_STATIC_DEMO': JSON.stringify('1'),
    'process.env': '{}',
    'process.argv': '[]',
  },
  resolve: {
    alias: [
      { find: 'node:sqlite', replacement: shim('sqlite.ts') },
      { find: 'node:crypto', replacement: shim('crypto.ts') },
      { find: /^node:(fs|path|url)$/, replacement: shim('node.ts') },
    ],
  },
  build: { outDir: 'dist-demo', target: 'esnext', emptyOutDir: true },
});
