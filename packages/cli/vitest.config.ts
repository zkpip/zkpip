import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const CORE_DIR     = resolve(__dirname, '../core');
const CORE_SRC     = resolve(CORE_DIR, 'src');
const SCHEMAS_DIR  = resolve(CORE_DIR, 'schemas');
const CLI_SRC      = resolve(__dirname, 'src'); 

export default defineConfig({
  root: __dirname,
  test: { environment: 'node', globals: true },
  resolve: {
    alias: [
      { find: '@zkpip/core/seal/v1',        replacement: resolve(CORE_SRC, 'seal', 'v1.ts') },
      { find: '@zkpip/core/json/c14n',      replacement: resolve(CORE_SRC, 'json', 'c14n.ts') },
      { find: '@zkpip/core/kind',           replacement: resolve(CORE_SRC, 'kind.ts') },
      { find: '@zkpip/core/keys/keyId',     replacement: resolve(CORE_SRC, 'keys', 'keyId.ts') },
      { find: '@zkpip/core/json',           replacement: resolve(CORE_SRC, 'json', 'index.ts') },
      { find: '@zkpip/core/validation/ajv', replacement: resolve(CLI_SRC, 'core-shims', 'validation-ajv.js') },
      { find: '@zkpip/core',                replacement: resolve(CORE_SRC, 'index.ts') },

      { find: /^@zkpip\/core\/schemas\/(.*)$/, replacement: `${SCHEMAS_DIR}/$1` },      
      { find: /^@zkpip\/core\/(.*)$/, replacement: `${CORE_SRC}/$1.ts` },
    ],
    conditions: ['import', 'module', 'default'],
  },
});
