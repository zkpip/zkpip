import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Monorepo: packages/cli  → sibling  → packages/core/src
const CORE_SRC = resolve(__dirname, '../core/src');

export default defineConfig({
  root: __dirname,
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: [
      { find: '@zkpip/core/seal/v1',    replacement: resolve(CORE_SRC, 'seal', 'v1.ts') },
      { find: '@zkpip/core/json/c14n',  replacement: resolve(CORE_SRC, 'json', 'c14n.ts') },
      { find: '@zkpip/core/kind',       replacement: resolve(CORE_SRC, 'kind.ts') },
      { find: '@zkpip/core/keys/keyId', replacement: resolve(CORE_SRC, 'keys', 'keyId.ts') },
      { find: '@zkpip/core/json',       replacement: resolve(CORE_SRC, 'json', 'index.ts') },
      { find: '@zkpip/core',            replacement: resolve(CORE_SRC, 'index.ts') },

      { find: /^@zkpip\/core\/(.*)$/,   replacement: `${CORE_SRC}/$1.ts` },
    ],
    conditions: ['import', 'module', 'default'],
  },
});
