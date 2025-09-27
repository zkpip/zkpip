import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));     // .../packages/cli
const coreDist = path.resolve(here, '../core/dist');           // .../packages/core/dist

console.log('[vitest] coreDist =', coreDist); // DEBUG: lásd futáskor

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/__tests__/**/*.test.ts',
      'src/__tests__/**/*.test.ts',
    ],
    environment: 'node',
  },
  resolve: {
    alias: {
      // ELMÉLETI csomag-subpath → KONKRÉT dist fájlok
      '@zkpip/core/json/c14n': path.join(coreDist, 'json/c14n.js'),
      '@zkpip/core/json':      path.join(coreDist, 'json/index.js'),
      '@zkpip/core':           path.join(coreDist, 'index.js'),
    },
  },
});
