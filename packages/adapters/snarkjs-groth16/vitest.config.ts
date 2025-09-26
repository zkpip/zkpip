import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tsconfigPaths({
      // ha külön `tsconfig.paths.json`-t használsz:
      projects: [resolve(here, 'tsconfig.paths.json'), resolve(here, 'tsconfig.json')],
    }),
  ],
  resolve: {
    alias: {
      // Biztos ami biztos: explicit alias a core csomagra (forrás TS-re mutasson)
      '@zkpip/adapters-core': resolve(here, 'packages/adapters/adapters-core/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    // (opcionális) include pattern a monorepóhoz
    include: ['packages/**/src/__tests__/**/*.{test,spec}.ts'],
  },
});
